import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PeliculasService } from '../../services/peliculas';

// export interface Pelicula {
//   id: number;
//   nombre: string;
//   sinopsis: string;
//   duracion_minutos: number;
//   imagen_url: string;
//   clasificacion: string;
//   genero: string;
//   activa: boolean;
//   fecha_estreno: Date | null; // puede ser null
// }


@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class AdminComponent implements OnInit {
  //Reactive form, lo defino en ts
  formPelicula!: FormGroup;
  formFuncion!: FormGroup;
  formCandy!: FormGroup;

  peliculas: any[] = [];
  salas: any[] = [];
  funciones: any[] = [];
  funcionesPeliculaSeleccionada: any[] = [];
  productosCandy: any[] = [];

  mensajePelicula: string = '';
  mensajeFuncion: string = '';
  mensajeCandy: string = '';

  productoEnEdicionId: number | null = null;

  listaGeneros: string[] = ['Acción', 'Aventura', 'Comedia', 'Drama', 'Ciencia Ficción', 'Terror', 'Animación'];
  generosSeleccionados: string[] = [];

  constructor(
    private fb: FormBuilder,
    private peliculasService: PeliculasService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.inicializarFormularios();
    this.cargarDatosIniciales();
  }

  private inicializarFormularios(): void {
    this.formPelicula = this.fb.group({
      nombre: ['', Validators.required],
      sinopsis: ['', Validators.required],
      duracion_minutos: ['', [Validators.required, Validators.min(1)]],
      clasificacion: ['ATP', Validators.required],
      imagen_url: ['', Validators.required],
      fecha_estreno: ['']
    });

    this.formFuncion = this.fb.group({
      pelicula_id: ['', Validators.required],
      sala_id: [''], // Opcional para permitir la asignación automática (RF-08)
      fecha_hora: ['', Validators.required],
      formato: ['2D', Validators.required],
      idioma: ['Castellano', Validators.required]
    });

    this.formCandy = this.fb.group({
      nombre: ['', Validators.required],
      descripcion: [''],
      precio: ['', [Validators.required, Validators.min(0)]],
      categoria: ['Pochoclos', Validators.required],
      imagen_url: [''],
      es_combo: [false]
    });
  }

  async cargarDatosIniciales() {
    try {
      this.peliculas = await this.peliculasService.obtenerPeliculas();
      this.salas = await this.peliculasService.obtenerSalas();
      this.funciones = await this.peliculasService.obtenerFunciones();

      if (typeof this.peliculasService.obtenerProductosCandy === 'function') {
        this.productosCandy = await this.peliculasService.obtenerProductosCandy();
      }

      const peliId = this.formFuncion.get('pelicula_id')?.value;
      if (peliId) {
        this.actualizarFuncionesPelicula(peliId);
      }

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al cargar datos iniciales:', error);
    }
  }

  // --- CANDY BAR ---

  async guardarProductoCandy() {
    if (this.formCandy.invalid) return;

    try {
      const val = this.formCandy.value;
      const producto = {
        id: this.productoEnEdicionId || undefined,
        nombre: val.nombre,
        descripcion: val.descripcion,
        precio: Number(val.precio),
        categoria: val.categoria,
        imagen_url: val.imagen_url,
        es_combo: !!val.es_combo
      };

      await this.peliculasService.guardarProductoCandy(producto);

      this.mensajeCandy = this.productoEnEdicionId 
        ? '¡Producto actualizado con éxito!' 
        : '¡Producto creado con éxito!';

      this.limpiarFormCandy();
      await this.cargarDatosIniciales();
    } catch (error: any) {
      console.error('Error al guardar producto candy:', error);
      this.mensajeCandy = `Error: ${error.message || 'No se pudo guardar el producto.'}`;
    } finally {
      this.cdr.detectChanges();
    }
  }

  editarProductoCandy(p: any) {
    this.productoEnEdicionId = Number(p.id);

    this.formCandy.setValue({
      nombre: p.nombre || '',
      descripcion: p.descripcion || '',
      precio: p.precio !== undefined ? p.precio : '',
      categoria: p.categoria || 'Pochoclos',
      imagen_url: p.imagen_url || '',
      es_combo: p.es_combo || false
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.cdr.detectChanges();
  }

  limpiarFormCandy() {
    this.productoEnEdicionId = null;
    this.formCandy.reset({
      categoria: 'Pochoclos',
      es_combo: false
    });
    this.cdr.detectChanges();
  }

  async alternarVisibilidadCandy(p: any) {
    try {
      const estadoActual = p.activo !== false;
      const nuevoEstado = !estadoActual;

      await this.peliculasService.cambiarVisibilidadProductoCandy(Number(p.id), nuevoEstado);
      p.activo = nuevoEstado;

      this.cdr.detectChanges();
    } catch (error: any) {
      console.error('Error al cambiar disponibilidad:', error);
      alert('Error al actualizar disponibilidad en Supabase.');
    }
  }

  // --- PELÍCULAS Y FUNCIONES ---

  onPeliculaChange(event: any) {
    const peliculaId = event.target.value;
    this.actualizarFuncionesPelicula(peliculaId);
    this.cdr.detectChanges();
  }

  actualizarFuncionesPelicula(peliculaId: any) {
    if (!peliculaId) {
      this.funcionesPeliculaSeleccionada = [];
      return;
    }
    this.funcionesPeliculaSeleccionada = this.funciones.filter(
      f => Number(f.pelicula_id) === Number(peliculaId)
    );
  }

  onGeneroChange(event: any, genero: string): void {
    if (event.target.checked) {
      this.generosSeleccionados.push(genero);
    } else {
      this.generosSeleccionados = this.generosSeleccionados.filter(g => g !== genero);
    }
  }

  calcularHoraFin(fechaHoraInicio: string, duracionMinutos: number | string): string {
    if (!fechaHoraInicio) return '';

    const fechaLimpia = String(fechaHoraInicio).split('+')[0].replace('Z', '');
    const fecha = new Date(fechaLimpia);

    if (isNaN(fecha.getTime())) return '';

    const duracion = Number(duracionMinutos) || 120;
    const fechaFin = new Date(fecha.getTime() + duracion * 60 * 1000);

    const horas = fechaFin.getHours().toString().padStart(2, '0');
    const minutos = fechaFin.getMinutes().toString().padStart(2, '0');

    return `${horas}:${minutos}`;
  }

  async alternarVisibilidad(pelicula: any) {
    try {
      const estadoActual = pelicula.activa === true || pelicula.activa === undefined || pelicula.activa === null;
      const nuevoEstado = !estadoActual;

      await this.peliculasService.cambiarVisibilidadPelicula(Number(pelicula.id), nuevoEstado);
      pelicula.activa = nuevoEstado;

      this.cdr.detectChanges();
    } catch (error: any) {
      console.error('Error al cambiar visibilidad:', error);
      alert('No se pudo guardar la visibilidad en Supabase.');
    }
  }

  async guardarPelicula() {
    if (this.formPelicula.invalid) return;

    if (this.generosSeleccionados.length === 0) {
      this.mensajePelicula = 'Debes seleccionar al menos un género.';
      return;
    }

    try {
      const formVal = this.formPelicula.value;
      const nuevaPelicula = {
        nombre: formVal.nombre,
        sinopsis: formVal.sinopsis,
        duracion_minutos: Number(formVal.duracion_minutos),
        genero: this.generosSeleccionados,
        clasificacion: formVal.clasificacion,
        imagen_url: formVal.imagen_url,
        fecha_estreno: formVal.fecha_estreno ? formVal.fecha_estreno : null
      };

      await this.peliculasService.guardarPelicula(nuevaPelicula);

      this.mensajePelicula = '¡Película guardada con éxito!';
      this.formPelicula.reset({ clasificacion: 'ATP' });
      this.generosSeleccionados = [];

      await this.cargarDatosIniciales();
    } catch (error: any) {
      console.error('Error al guardar la película:', error);
      this.mensajePelicula = `Error: ${error.message || 'No se pudo guardar la película.'}`;
    } finally {
      this.cdr.detectChanges();
    }
  }

  // RF-08: PROGRAMACIÓN Y ASIGNACIÓN AUTOMÁTICA DE SALAS
  async guardarFuncion() {
    if (this.formFuncion.invalid) return;

    try {
      this.funciones = await this.peliculasService.obtenerFunciones();
    } catch (e) {
      console.error('Error al actualizar funciones antes de validar:', e);
    }

    const { pelicula_id, sala_id, fecha_hora, formato, idioma } = this.formFuncion.value;

    const peliculaElegida = this.peliculas.find(p => Number(p.id) === Number(pelicula_id));
    const duracionPelicula = Number(peliculaElegida?.duracion_minutos || peliculaElegida?.duracion || 120);

    const fechaLimpiaNueva = fecha_hora.replace('Z', '').replace('+00:00', '');
    const inicioNueva = new Date(fechaLimpiaNueva).getTime();
    // Duración de la película + 30 minutos de descanso/limpieza
    const finNueva = inicioNueva + (duracionPelicula + 30) * 60 * 1000;

    let salaIdFinal: number | null = sala_id ? Number(sala_id) : null;

    // Si el usuario especificó una sala en el formulario, validamos su disponibilidad
    if (salaIdFinal) {
      const funcionesDeMismaSala = this.funciones.filter(f => Number(f.sala_id) === salaIdFinal);

      for (const f of funcionesDeMismaSala) {
        if (!f.fecha_hora) continue;

        const fechaLimpiaExistente = String(f.fecha_hora).split('+')[0].replace('Z', '');
        const inicioExistente = new Date(fechaLimpiaExistente).getTime();

        if (isNaN(inicioExistente)) continue;

        let duracionExistente = 120;
        if (f.peliculas && (f.peliculas.duracion_minutos || f.peliculas.duracion)) {
          duracionExistente = Number(f.peliculas.duracion_minutos || f.peliculas.duracion);
        } else {
          const peliRel = this.peliculas.find(p => Number(p.id) === Number(f.pelicula_id));
          if (peliRel) {
            duracionExistente = Number(peliRel.duracion_minutos || peliRel.duracion || 120);
          }
        }

        const finExistente = inicioExistente + (duracionExistente + 30) * 60 * 1000;

        if (inicioNueva < finExistente && finNueva > inicioExistente) {
          this.mensajeFuncion = '❌ Error: La sala seleccionada ya está ocupada en ese horario (debe haber al menos 30 min de descanso entre funciones).';
          this.cdr.detectChanges();
          return;
        }
      }
    } else {
      // RF-08: Asignación automática de sala sin superposición
      for (const sala of this.salas) {
        const idSalaEvaluar = Number(sala.id);
        const funcionesDeEstaSala = this.funciones.filter(f => Number(f.sala_id) === idSalaEvaluar);

        let tieneConflicto = false;

        for (const f of funcionesDeEstaSala) {
          if (!f.fecha_hora) continue;

          const fechaLimpiaExistente = String(f.fecha_hora).split('+')[0].replace('Z', '');
          const inicioExistente = new Date(fechaLimpiaExistente).getTime();

          if (isNaN(inicioExistente)) continue;

          let duracionExistente = 120;
          if (f.peliculas && (f.peliculas.duracion_minutos || f.peliculas.duracion)) {
            duracionExistente = Number(f.peliculas.duracion_minutos || f.peliculas.duracion);
          } else {
            const peliRel = this.peliculas.find(p => Number(p.id) === Number(f.pelicula_id));
            if (peliRel) {
              duracionExistente = Number(peliRel.duracion_minutos || peliRel.duracion || 120);
            }
          }

          const finExistente = inicioExistente + (duracionExistente + 30) * 60 * 1000;

          if (inicioNueva < finExistente && finNueva > inicioExistente) {
            tieneConflicto = true;
            break;
          }
        }

        if (!tieneConflicto) {
          salaIdFinal = idSalaEvaluar;
          break; // Se encontró la primera sala disponible
        }
      }

      if (!salaIdFinal) {
        this.mensajeFuncion = '❌ Error: No hay ninguna sala disponible en ese horario considerando los 30 min de limpieza/descanso.';
        this.cdr.detectChanges();
        return;
      }
    }

    try {
      const funcionAGuardar = {
        pelicula_id: Number(pelicula_id),
        sala_id: salaIdFinal,
        fecha_hora: fecha_hora,
        formato: formato,
        idioma: idioma
      };

      await this.peliculasService.guardarFuncion(funcionAGuardar);
      
      const nombreSalaAsignada = this.salas.find(s => Number(s.id) === salaIdFinal)?.nombre || `Sala #${salaIdFinal}`;
      this.mensajeFuncion = `¡Función programada con éxito en ${nombreSalaAsignada}!`;

      this.formFuncion.reset({ 
        pelicula_id: pelicula_id, 
        sala_id: '',
        formato: '2D', 
        idioma: 'Castellano' 
      });

      await this.cargarDatosIniciales();
    } catch (error: any) {
      console.error('Error al programar la función:', error);
      this.mensajeFuncion = `Error: ${error.message || 'No se pudo programar la función.'}`;
    } finally {
      this.cdr.detectChanges();
    }
  }
}