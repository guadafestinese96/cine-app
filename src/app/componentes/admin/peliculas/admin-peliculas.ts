import { ImagenRespaldoDirective } from '../../compartidos/imagen-respaldo';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PeliculasService, EstadoVenta } from '../../../services/peliculas';
import { AvisosService } from '../../../services/avisos';
import { AtajoFecha, CampoFechaComponent } from '../../compartidos/campo-fecha/campo-fecha';
import { CLASIFICACIONES, GENEROS, Pelicula } from '../../../core/modelos';
import { errorLegible, inicioDelDia, normalizarGeneros, sumarDias } from '../../../core/utilidades';

@Component({
  selector: 'app-admin-peliculas',
  imports: [ImagenRespaldoDirective, ReactiveFormsModule, CampoFechaComponent],
  templateUrl: './admin-peliculas.html',
})
export class AdminPeliculasComponent {
  private srv = inject(PeliculasService);
  private avisos = inject(AvisosService);

  readonly generos = GENEROS;
  readonly clasificaciones = CLASIFICACIONES;

  peliculas = signal<Pelicula[]>([]);
  editando = signal<Pelicula | null>(null);
  generosElegidos = signal<string[]>([]);
  guardando = signal(false);
  busqueda = signal('');

  filtradas = computed(() => {
    const t = this.busqueda().toLowerCase().trim();
    return this.peliculas().filter((p) => !t || p.nombre.toLowerCase().includes(t));
  });

  /** Los estrenos en Argentina son los jueves: atajos a los próximos jueves */
  readonly atajosEstreno: AtajoFecha[] = (() => {
    const hoy = inicioDelDia(new Date());
    const jueves = sumarDias(hoy, (4 - hoy.getDay() + 7) % 7 || 7);
    return [
      { etiqueta: 'Hoy', fecha: hoy },
      { etiqueta: 'Este jueves', fecha: jueves },
      { etiqueta: 'Jueves siguiente', fecha: sumarDias(jueves, 7) },
      { etiqueta: 'En 3 semanas', fecha: sumarDias(jueves, 14) },
    ];
  })();

  form = inject(FormBuilder).nonNullable.group({
    nombre: ['', Validators.required],
    sinopsis: ['', Validators.required],
    duracion_minutos: [120, [Validators.required, Validators.min(30), Validators.max(400)]],
    clasificacion: ['ATP', Validators.required],
    imagen_url: ['', Validators.required],
    fecha_estreno: [''],
    preventa_activa: [false],
    precio_preventa: [0],
  });

  constructor() {
    this.cargar();
  }

  async cargar() {
    try {
      this.peliculas.set(await this.srv.listar(true));
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }

  estado(p: Pelicula): EstadoVenta {
    return this.srv.estadoVenta(p);
  }

  textoEstado(p: Pelicula): string {
    const textos: Record<EstadoVenta, string> = {
      cartelera: 'En cartelera',
      preventa: 'En preventa',
      proximamente: 'Próximamente',
      oculta: 'Oculta',
    };
    return textos[this.estado(p)];
  }

  alternarGenero(g: string) {
    this.generosElegidos.update((l) => (l.includes(g) ? l.filter((x) => x !== g) : [...l, g]));
  }

  editar(p: Pelicula) {
    this.editando.set(p);
    this.generosElegidos.set(normalizarGeneros(p.genero));
    this.form.setValue({
      nombre: p.nombre,
      sinopsis: p.sinopsis ?? '',
      duracion_minutos: p.duracion_minutos,
      clasificacion: p.clasificacion ?? 'ATP',
      imagen_url: p.imagen_url ?? '',
      fecha_estreno: p.fecha_estreno ?? '',
      preventa_activa: !!p.preventa_activa,
      precio_preventa: Number(p.precio_preventa ?? 0),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  nueva() {
    this.editando.set(null);
    this.generosElegidos.set([]);
    this.form.reset();
  }

  async guardar() {
    if (this.form.invalid || !this.generosElegidos().length) {
      this.form.markAllAsTouched();
      if (!this.generosElegidos().length) this.avisos.error('Elegí al menos un género.');
      return;
    }
    const v = this.form.getRawValue();
    if (v.preventa_activa && (!v.fecha_estreno || !v.precio_preventa)) {
      this.avisos.error('Para la preventa hacen falta la fecha de estreno y el precio especial.');
      return;
    }
    this.guardando.set(true);
    try {
      await this.srv.guardar({
        id: this.editando()?.id,
        ...v,
        genero: this.generosElegidos(),
        precio_preventa: v.preventa_activa ? v.precio_preventa : null,
      });
      this.avisos.exito(this.editando() ? 'Película actualizada.' : 'Película creada.');
      this.nueva();
      await this.cargar();
    } catch (e) {
      this.avisos.error(errorLegible(e));
    } finally {
      this.guardando.set(false);
    }
  }

  async alternarVisibilidad(p: Pelicula) {
    try {
      await this.srv.cambiarVisibilidad(p, p.activa === false);
      await this.cargar();
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }
}
