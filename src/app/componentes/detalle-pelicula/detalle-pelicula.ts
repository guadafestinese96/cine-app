import { ImagenRespaldoDirective } from '../compartidos/imagen-respaldo';
import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { PeliculasService, Puntaje } from '../../services/peliculas';
import { FuncionesService } from '../../services/funciones';
import { AuthService } from '../../services/auth';
import { AvisosService } from '../../services/avisos';
import { ConfiguracionService } from '../../services/configuracion';
import { ComprasService } from '../../services/compras';
import { EstrellasComponent } from '../compartidos/estrellas/estrellas';
import { Funcion, Pelicula, Resena } from '../../core/modelos';
import {
  aFechaIso, edadMinima, errorLegible, etiquetaDia, formatearHora, normalizarGeneros, parsearFechaLocal,
} from '../../core/utilidades';

interface DiaFunciones {
  clave: string;
  etiqueta: string;
  funciones: Funcion[];
}

@Component({
  selector: 'app-detalle-pelicula',
  imports: [ImagenRespaldoDirective, RouterLink, DatePipe, EstrellasComponent],
  templateUrl: './detalle-pelicula.html',
  styleUrl: './detalle-pelicula.css',
})
export class DetallePelicula {
  private peliculasSrv = inject(PeliculasService);
  private funcionesSrv = inject(FuncionesService);
  private config = inject(ConfiguracionService);
  private compras = inject(ComprasService);
  private router = inject(Router);
  private avisos = inject(AvisosService);
  auth = inject(AuthService);

  /** Viene de la ruta /pelicula/:id */
  id = input.required<string>();

  cargando = signal(true);
  pelicula = signal<Pelicula | null>(null);
  funciones = signal<Funcion[]>([]);
  resenas = signal<Resena[]>([]);
  diaElegido = signal('');
  formatoElegido = signal('');

  miEstrellas = signal(0);
  miComentario = signal('');
  guardandoResena = signal(false);

  generos = computed(() => normalizarGeneros(this.pelicula()?.genero ?? null));
  estado = computed(() => (this.pelicula() ? this.peliculasSrv.estadoVenta(this.pelicula()!) : 'oculta'));
  enVenta = computed(() => this.estado() === 'cartelera' || this.estado() === 'preventa');
  restriccion = computed(() => edadMinima(this.pelicula()?.clasificacion));

  puntaje = computed<Puntaje | null>(() => {
    const r = this.resenas();
    if (!r.length) return null;
    return { promedio: r.reduce((t, x) => t + x.estrellas, 0) / r.length, cantidad: r.length };
  });

  miResena = computed(() => this.resenas().find((r) => r.usuario_id === this.auth.usuarioActual()?.id) ?? null);

  formatos = computed(() => [...new Set(this.funciones().map((f) => `${f.formato} · ${f.idioma}`))]);

  dias = computed<DiaFunciones[]>(() => {
    const mapa = new Map<string, DiaFunciones>();
    for (const f of this.funciones()) {
      if (this.formatoElegido() && `${f.formato} · ${f.idioma}` !== this.formatoElegido()) continue;
      const fecha = parsearFechaLocal(f.fecha_hora);
      const clave = aFechaIso(fecha);
      if (!mapa.has(clave)) mapa.set(clave, { clave, etiqueta: etiquetaDia(fecha), funciones: [] });
      mapa.get(clave)!.funciones.push(f);
    }
    return [...mapa.values()];
  });

  funcionesDelDia = computed(() => {
    const dias = this.dias();
    const dia = dias.find((d) => d.clave === this.diaElegido()) ?? dias[0];
    return dia?.funciones ?? [];
  });

  diaActivo = computed(() => this.dias().find((d) => d.clave === this.diaElegido())?.clave ?? this.dias()[0]?.clave);

  async ngOnInit() {
    const id = Number(this.id());
    try {
      await this.config.cargar();
      const [pelicula, funciones, resenas] = await Promise.all([
        this.peliculasSrv.obtener(id),
        this.funcionesSrv.listar({ peliculaId: id, soloFuturas: true }),
        this.peliculasSrv.resenas(id),
      ]);
      this.pelicula.set(pelicula);
      this.funciones.set(funciones);
      this.resenas.set(resenas);
      const mia = this.miResena();
      if (mia) {
        this.miEstrellas.set(mia.estrellas);
        this.miComentario.set(mia.comentario ?? '');
      }
    } catch (e) {
      this.avisos.error(errorLegible(e));
    } finally {
      this.cargando.set(false);
    }
  }

  hora(f: Funcion) {
    return formatearHora(parsearFechaLocal(f.fecha_hora));
  }

  precio(f: Funcion) {
    return this.peliculasSrv.precioEntrada(this.pelicula() ?? undefined, f);
  }

  estreno(): Date | null {
    const p = this.pelicula();
    return p?.fecha_estreno ? parsearFechaLocal(p.fecha_estreno) : null;
  }

  elegirFuncion(f: Funcion) {
    this.compras.iniciar(f.id);
    this.router.navigate(['/sala', f.id]);
  }

  async publicarResena() {
    const u = this.auth.usuarioActual();
    const p = this.pelicula();
    if (!u || !p || !this.miEstrellas()) return;
    this.guardandoResena.set(true);
    try {
      await this.peliculasSrv.guardarResena({
        pelicula_id: p.id,
        usuario_id: u.id,
        autor: `${u.nombre} ${u.apellido?.[0] ? u.apellido[0] + '.' : ''}`.trim() || u.email.split('@')[0],
        estrellas: this.miEstrellas(),
        comentario: this.miComentario().trim(),
      });
      this.resenas.set(await this.peliculasSrv.resenas(p.id));
      this.avisos.exito('Reseña publicada.');
    } catch (e) {
      this.avisos.error(errorLegible(e));
    } finally {
      this.guardandoResena.set(false);
    }
  }
}
