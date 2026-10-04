import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PeliculasService } from '../../services/peliculas';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalogo.html',
  styleUrl: './catalogo.css'
})
export class CatalogoComponent implements OnInit {
  peliculas: any[] = [];
  funciones: any[] = [];
  topPeliculas: any[] = []; 
  proximosEstrenos: any[] = []; // RF-06: Próximamente

  textoBusqueda: string = '';
  generoSeleccionado: string = 'Todos';

  constructor(
    private peliculasService: PeliculasService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.cargarCartelera();
  }

  async cargarCartelera() {
    try {
      if (typeof this.peliculasService.obtenerPeliculasActivas === 'function') {
        this.peliculas = await this.peliculasService.obtenerPeliculasActivas();
      } else {
        this.peliculas = await this.peliculasService.obtenerPeliculas();
      }

      this.funciones = await this.peliculasService.obtenerFunciones();

      if (typeof this.peliculasService.obtenerTopPeliculasMasVendidas === 'function') {
        this.topPeliculas = await this.peliculasService.obtenerTopPeliculasMasVendidas();
      }

      // Cargar próximos estrenos
      if (typeof this.peliculasService.obtenerProximosEstrenos === 'function') {
        this.proximosEstrenos = await this.peliculasService.obtenerProximosEstrenos();
      }

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al cargar la cartelera:', error);
    }
  }

  get peliculasFiltradas() {
    const hoy = new Date().toISOString().split('T')[0];

    return this.peliculas.filter(pelicula => {
      // Ocultar si está desactivada o si su fecha de estreno es futura (pertenece a Próximamente)
      const esActiva = pelicula.activa !== false;
      const esEstrenada = !pelicula.fecha_estreno || pelicula.fecha_estreno <= hoy;
      
      if (!esActiva || !esEstrenada) return false;

      // Filtro por nombre
      const nombrePeli = pelicula.nombre || pelicula.titulo || '';
      const coincideNombre = nombrePeli.toLowerCase().includes(this.textoBusqueda.toLowerCase().trim());

      // Filtro por género
      let coincideGenero = false;
      if (this.generoSeleccionado === 'Todos') {
        coincideGenero = true;
      } else if (pelicula.genero) {
        let listaGeneros: string[] = [];
        if (typeof pelicula.genero === 'string' && pelicula.genero.startsWith('[')) {
          try { listaGeneros = JSON.parse(pelicula.genero); } catch (e) { listaGeneros = [pelicula.genero]; }
        } else if (Array.isArray(pelicula.genero)) {
          listaGeneros = pelicula.genero;
        } else {
          listaGeneros = [pelicula.genero];
        }
        coincideGenero = listaGeneros.includes(this.generoSeleccionado);
      }

      return coincideNombre && coincideGenero;
    });
  }

  async activarAlerta(pelicula: any) {
    const usuarioLogueado = localStorage.getItem('usuario_logueado');
    const usuario = usuarioLogueado ? JSON.parse(usuarioLogueado) : null;

    if (!usuario || !usuario.email) {
      alert('Debes iniciar sesión para activar las alertas de estreno.');
      return;
    }

    try {
      await this.peliculasService.activarAlertaEstreno(pelicula.id, usuario.email);
      alert(`🔔 ¡Alerta activada! Te avisaremos cuando se habiliten las entradas para "${pelicula.nombre || pelicula.titulo}".`);
    } catch (error) {
      console.error('Error al activar alerta:', error);
      alert('Ya tienes una alerta registrada para esta película o se produjo un error.');
    }
  }

  getFuncionesDePelicula(peliculaId: number) {
    return this.funciones.filter(f => Number(f.pelicula_id) === Number(peliculaId));
  }

  seleccionarFuncion(funcion: any) {
    localStorage.setItem('funcion_seleccionada', JSON.stringify(funcion));
    this.router.navigate(['/sala']);
  }
}