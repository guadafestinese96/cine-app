import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PeliculasService } from '../../services/peliculas';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class AdminComponent implements OnInit {
  formPelicula: FormGroup;
  formFuncion: FormGroup;
  mensajePelicula: string = '';
  mensajeFuncion: string = '';

  peliculas: any[] = [];
  salas: any[] = [];

  constructor(
    private fb: FormBuilder,
    private peliculasService: PeliculasService
  ) {
    // Formulario de Película
    this.formPelicula = this.fb.group({
      nombre: ['', Validators.required],
      sinopsis: ['', Validators.required],
      duracion_minutos: [120, [Validators.required, Validators.min(1)]],
      categoria: ['Acción', Validators.required],
      clasificacion: ['ATP', Validators.required],
      imagen_url: ['', Validators.required]
    });

    // Formulario de Función
    this.formFuncion = this.fb.group({
      pelicula_id: ['', Validators.required],
      sala_id: ['', Validators.required],
      fecha_hora: ['', Validators.required],
      formato: ['2D', Validators.required],
      idioma: ['Castellano', Validators.required],
      precio_base: [5000, [Validators.required, Validators.min(0)]]
    });
  }

  async ngOnInit() {
    await this.cargarDatos();
  }

  async cargarDatos() {
    this.peliculas = await this.peliculasService.obtenerPeliculas();
    this.salas = await this.peliculasService.obtenerSalas();
  }

  async guardarPelicula() {
    if (this.formPelicula.invalid) return;
    try {
      await this.peliculasService.agregarPelicula(this.formPelicula.value);
      this.mensajePelicula = '¡Película agregada con éxito!';
      this.formPelicula.reset({ duracion_minutos: 120, categoria: 'Acción', clasificacion: 'ATP' });
      await this.cargarDatos();
    } catch (error: any) {
      this.mensajePelicula = 'Error: ' + error.message;
    }
  }

  async guardarFuncion() {
    if (this.formFuncion.invalid) return;

    this.mensajeFuncion = '';
    const { pelicula_id, sala_id, fecha_hora, formato, idioma, precio_base } = this.formFuncion.value;

    const nuevaInicio = new Date(fecha_hora).getTime();
    const peliculaSeleccionada = this.peliculas.find(p => p.id == pelicula_id);
    const duracionMs = (peliculaSeleccionada?.duracion_minutos || 120) * 60 * 1000;
    const nuevaFin = nuevaInicio + duracionMs;

    // Obtener funciones agendadas en la misma sala
    const funcionesExistentes = await this.peliculasService.obtenerFuncionesPorSala(Number(sala_id));
    const MARGEN_MS = 30 * 60 * 1000; // 30 minutos de limpieza

    for (const f of funcionesExistentes) {
      const fInicio = new Date(f.fecha_hora).getTime();
      const fDuracionMs = (f.peliculas?.duracion_minutos || 120) * 60 * 1000;
      const fFin = fInicio + fDuracionMs;

      // Verificar superposición incluyendo el margen de 30 min
      if (nuevaInicio < (fFin + MARGEN_MS) && nuevaFin > (fInicio - MARGEN_MS)) {
        this.mensajeFuncion = `⚠️ Error: La sala está ocupada o necesita 30 min de limpieza entre funciones. Hay una función de ${new Date(fInicio).toLocaleTimeString()} a ${new Date(fFin).toLocaleTimeString()}.`;
        return;
      }
    }

    try {
      await this.peliculasService.agregarFuncion({
        pelicula_id: Number(pelicula_id),
        sala_id: Number(sala_id),
        fecha_hora,
        formato,
        idioma,
        precio_base: Number(precio_base)
      });
      this.mensajeFuncion = '¡Función programada exitosamente!';
      this.formFuncion.reset({ formato: '2D', idioma: 'Castellano', precio_base: 5000 });
    } catch (error: any) {
      this.mensajeFuncion = 'Error al crear función: ' + error.message;
    }
  }
}