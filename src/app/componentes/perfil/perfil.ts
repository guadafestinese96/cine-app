import { ImagenRespaldoDirective } from '../compartidos/imagen-respaldo';
import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { ComprasService } from '../../services/compras';
import { FidelidadService } from '../../services/fidelidad';
import { PeliculasService } from '../../services/peliculas';
import { AvisosService } from '../../services/avisos';
import { EstrellasComponent } from '../compartidos/estrellas/estrellas';
import { Canje, Compra, Recompensa, Resena } from '../../core/modelos';
import { errorLegible, formatearFuncion, parsearFechaLocal } from '../../core/utilidades';

type Seccion = 'entradas' | 'peliculas' | 'puntos';

interface PeliculaVista {
  peliculaId: number;
  nombre: string;
  imagen: string;
  fecha: Date;
  veces: number;
  estrellas: number;
}

@Component({
  selector: 'app-perfil',
  imports: [ImagenRespaldoDirective, RouterLink, DatePipe, EstrellasComponent],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class PerfilComponent {
  auth = inject(AuthService);
  comprasSrv = inject(ComprasService);
  private fidelidad = inject(FidelidadService);
  private peliculasSrv = inject(PeliculasService);
  private avisos = inject(AvisosService);
  private router = inject(Router);

  seccion = input<Seccion>();

  cargando = signal(true);
  compras = signal<Compra[]>([]);
  recompensas = signal<Recompensa[]>([]);
  canjes = signal<Canje[]>([]);
  resenas = signal<Resena[]>([]);
  confirmando = signal<string | null>(null);
  ultimoCanje = signal<string | null>(null);

  activa = computed<Seccion>(() => this.seccion() ?? 'entradas');

  proximas = computed(() =>
    this.compras().filter((c) => c.estado === 'pagada' && parsearFechaLocal(c.funciones?.fecha_hora ?? '').getTime() > Date.now()),
  );
  anteriores = computed(() => this.compras().filter((c) => !this.proximas().includes(c)));

  /** "Mis películas": todo lo que ya vio (funciones pasadas, no canceladas), una tarjeta por película */
  peliculasVistas = computed<PeliculaVista[]>(() => {
    const mapa = new Map<number, PeliculaVista>();
    const ahora = Date.now();
    for (const c of this.compras()) {
      const f = c.funciones;
      if (c.estado === 'cancelada' || !f?.peliculas) continue;
      const fecha = parsearFechaLocal(f.fecha_hora);
      if (fecha.getTime() > ahora && !c.entrada_validada_at) continue;
      const id = Number(f.peliculas.id);
      const previa = mapa.get(id);
      if (previa) {
        previa.veces++;
        if (fecha > previa.fecha) previa.fecha = fecha;
      } else {
        mapa.set(id, {
          peliculaId: id,
          nombre: f.peliculas.nombre,
          imagen: f.peliculas.imagen_url,
          fecha,
          veces: 1,
          estrellas: this.resenas().find((r) => Number(r.pelicula_id) === id)?.estrellas ?? 0,
        });
      }
    }
    return [...mapa.values()].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  });

  async ngOnInit() {
    try {
      await this.auth.refrescar();
      const u = this.auth.usuarioActual()!;
      const [compras, recompensas, canjes, resenas] = await Promise.all([
        this.comprasSrv.misCompras(),
        this.fidelidad.recompensas(),
        this.fidelidad.misCanjes(),
        this.peliculasSrv.resenasDeUsuario(u.id),
      ]);
      this.compras.set(compras);
      this.recompensas.set(recompensas);
      this.canjes.set(canjes);
      this.resenas.set(resenas);
    } catch (e) {
      this.avisos.error(errorLegible(e));
    } finally {
      this.cargando.set(false);
    }
  }

  irA(seccion: Seccion) {
    this.router.navigate([], { queryParams: { seccion: seccion === 'entradas' ? null : seccion }, replaceUrl: true });
  }

  funcionTexto(c: Compra) {
    return c.funciones ? formatearFuncion(c.funciones.fecha_hora) : '';
  }

  butacasTexto(c: Compra) {
    return c.butacas.map((b) => `${b.fila}${b.numero}`).join(', ');
  }

  reintegro(c: Compra) {
    return Number(c.total_pagado) + Number(c.credito_usado);
  }

  async cancelar(c: Compra) {
    try {
      const credito = await this.comprasSrv.cancelar(c);
      this.compras.update((lista) => lista.map((x) => (x.codigo === c.codigo ? { ...x, estado: 'cancelada' as const } : x)));
      this.avisos.exito(`Compra cancelada. Te acreditamos $${credito} para tu próxima compra.`);
    } catch (e) {
      this.avisos.error(errorLegible(e));
    } finally {
      this.confirmando.set(null);
    }
  }

  async canjear(r: Recompensa) {
    try {
      const codigo = await this.fidelidad.canjear(r);
      this.ultimoCanje.set(codigo);
      this.canjes.set(await this.fidelidad.misCanjes());
      this.avisos.exito(
        r.tipo === 'entrada'
          ? `Canjeaste "${r.nombre}". Se aplica en tu próxima compra online.`
          : `Canjeaste "${r.nombre}". Mostrá el código ${codigo} en el candy bar.`,
      );
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }

  async calificar(p: PeliculaVista, estrellas: number) {
    const u = this.auth.usuarioActual();
    if (!u) return;
    const previa = this.resenas().find((r) => Number(r.pelicula_id) === p.peliculaId);
    try {
      await this.peliculasSrv.guardarResena({
        pelicula_id: p.peliculaId,
        usuario_id: u.id,
        autor: previa?.autor ?? `${u.nombre} ${u.apellido?.[0] ? u.apellido[0] + '.' : ''}`.trim(),
        estrellas,
        comentario: previa?.comentario ?? '',
      });
      this.resenas.set(await this.peliculasSrv.resenasDeUsuario(u.id));
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }
}
