import { ImagenRespaldoDirective } from '../compartidos/imagen-respaldo';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PeliculasService, Puntaje } from '../../services/peliculas';
import { FuncionesService } from '../../services/funciones';
import { AuthService } from '../../services/auth';
import { AvisosService } from '../../services/avisos';
import { NotificacionesService } from '../../services/notificaciones';
import { ConfiguracionService } from '../../services/configuracion';
import { EstrellasComponent } from '../compartidos/estrellas/estrellas';
import { Funcion, GENEROS, Pelicula } from '../../core/modelos';
import { edadMinima, errorLegible, normalizarGeneros, parsearFechaLocal } from '../../core/utilidades';

interface PeliculaCartel extends Pelicula {
  generos: string[];
  puntaje: Puntaje | null;
  vendidas: number;
  proximaFuncion: Funcion | null;
}

@Component({
  selector: 'app-catalogo',
  imports: [ImagenRespaldoDirective, RouterLink, DatePipe, EstrellasComponent],
  templateUrl: './catalogo.html',
  styleUrl: './catalogo.css',
})
export class CatalogoComponent {
  private peliculasSrv = inject(PeliculasService);
  private funcionesSrv = inject(FuncionesService);
  private auth = inject(AuthService);
  private avisos = inject(AvisosService);
  private notificaciones = inject(NotificacionesService);
  private config = inject(ConfiguracionService);

  cargando = signal(true);
  error = signal('');
  peliculas = signal<PeliculaCartel[]>([]);
  alertas = signal<number[]>([]);

  busqueda = signal('');
  generosElegidos = signal<string[]>([]);
  readonly generos = GENEROS;

  /** Las 3 más vendidas (entradas no canceladas) entre las que están a la venta */
  masVendidas = computed(() =>
    this.peliculas()
      .filter((p) => this.peliculasSrv.estaEnVenta(p) && p.vendidas > 0)
      .sort((a, b) => b.vendidas - a.vendidas)
      .slice(0, 3),
  );

  enCartelera = computed(() => this.peliculas().filter((p) => this.peliculasSrv.estadoVenta(p) === 'cartelera'));

  filtradas = computed(() => {
    const texto = this.normalizar(this.busqueda());
    const generos = this.generosElegidos();
    return this.enCartelera().filter((p) => {
      const coincideTexto = !texto || this.normalizar(p.nombre).includes(texto) || this.normalizar(p.sinopsis ?? '').includes(texto);
      const coincideGenero = !generos.length || p.generos.some((g) => generos.includes(g));
      return coincideTexto && coincideGenero;
    });
  });

  /** Géneros que realmente existen en la cartelera (para no mostrar filtros vacíos) */
  generosDisponibles = computed(() => {
    const presentes = new Set(this.enCartelera().flatMap((p) => p.generos));
    const conocidos = this.generos.filter((g) => presentes.has(g));
    const otros = [...presentes].filter((g) => !this.generos.includes(g));
    return [...conocidos, ...otros];
  });

  proximamente = computed(() =>
    this.peliculas()
      .filter((p) => ['preventa', 'proximamente'].includes(this.peliculasSrv.estadoVenta(p)))
      .sort((a, b) => String(a.fecha_estreno).localeCompare(String(b.fecha_estreno))),
  );

  constructor() {
    this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    try {
      await this.config.cargar();
      const [peliculas, funciones, puntajes, ventas] = await Promise.all([
        this.peliculasSrv.listar(),
        this.funcionesSrv.listar({ soloFuturas: true }),
        this.peliculasSrv.puntajes(),
        this.peliculasSrv.entradasVendidasPorPelicula(),
      ]);
      this.peliculas.set(
        peliculas.map((p) => ({
          ...p,
          generos: normalizarGeneros(p.genero),
          puntaje: puntajes.get(p.id) ?? null,
          vendidas: ventas.get(p.id) ?? 0,
          proximaFuncion: funciones.find((f) => Number(f.pelicula_id) === p.id) ?? null,
        })),
      );
      const u = this.auth.usuarioActual();
      if (u) this.alertas.set(await this.peliculasSrv.alertasDeUsuario(u.email));
    } catch (e) {
      this.error.set('No pudimos cargar la cartelera. ' + errorLegible(e));
    } finally {
      this.cargando.set(false);
    }
  }

  alternarGenero(g: string) {
    this.generosElegidos.update((lista) => (lista.includes(g) ? lista.filter((x) => x !== g) : [...lista, g]));
  }

  limpiarFiltros() {
    this.busqueda.set('');
    this.generosElegidos.set([]);
  }

  esPreventa(p: Pelicula) {
    return this.peliculasSrv.estadoVenta(p) === 'preventa';
  }

  aperturaPreventa(p: Pelicula) {
    return this.peliculasSrv.fechaAperturaPreventa(p);
  }

  estreno(p: Pelicula): Date {
    return parsearFechaLocal(p.fecha_estreno);
  }

  restringida(p: Pelicula) {
    return edadMinima(p.clasificacion) > 0;
  }

  async avisarme(p: Pelicula) {
    const u = this.auth.usuarioActual();
    if (!u) {
      this.avisos.mostrar('Iniciá sesión para que te avisemos cuando salgan las entradas.', 'info');
      return;
    }
    try {
      await this.peliculasSrv.activarAlerta(p.id, u.email);
      this.alertas.update((a) => [...a, p.id]);
      this.avisos.exito(`Listo. Te avisamos cuando salgan las entradas de "${p.nombre}".`);
      await this.notificaciones.pedirPermiso();
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }

  private normalizar(t: string): string {
    return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
}
