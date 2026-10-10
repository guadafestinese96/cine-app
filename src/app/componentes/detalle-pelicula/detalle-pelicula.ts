import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PeliculasService } from '../../services/peliculas';

@Component({
  selector: 'app-detalle-pelicula',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './detalle-pelicula.html',
  styleUrl: './detalle-pelicula.css'
})
export class DetallePelicula implements OnInit {
  pelicula: any = null;
  funciones: any[] = [];
  cargando: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private peliculasService: PeliculasService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    // Obtiene el ID enviado en la URL (/pelicula/:id)
    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      await this.cargarDetalle(Number(id));
    } else {
      this.cargando = false;
    }
  }

  async cargarDetalle(peliculaId: number) {
    try {
      this.cargando = true;

      // Obtener la película seleccionada
      const todasLasPeliculas = await this.peliculasService.obtenerPeliculas();
      this.pelicula = todasLasPeliculas.find((p: any) => Number(p.id) === peliculaId);

      // Obtener las funciones de esta película
      const todasLasFunciones = await this.peliculasService.obtenerFunciones();
      this.funciones = todasLasFunciones.filter(
        (f: any) => Number(f.pelicula_id) === peliculaId
      );

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al cargar la película:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  seleccionarFuncion(funcion: any) {
    localStorage.setItem('funcion_seleccionada', JSON.stringify(funcion));
    this.router.navigate(['/sala']);
  }
}