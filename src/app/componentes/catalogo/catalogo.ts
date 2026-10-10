import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PeliculasService } from '../../services/peliculas';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';

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
  proximosEstrenos: any[] = [];
  peliculasPreventa: any[] = [];

  textoBusqueda: string = '';
  generoSeleccionado: string = 'Todos';

  // Modal de Reseñas
  mostrarModalResenas: boolean = false;
  peliculaSeleccionadaModal: any = null;
  resenasModal: any[] = [];
  nuevaResenaTexto: string = '';
  nuevaResenaEstrellas: number = 5;

  // Modal Personalizado de Alerta
  mostrarModalAlerta: boolean = false;
  mensajeModalAlerta: string = '';

  constructor(
    private peliculasService: PeliculasService,
    private authService: AuthService,
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

      const hoy = new Date().toISOString().split('T')[0];

      // Cargar historial de compras y reseñas guardadas para calcular promedios
      const historial = JSON.parse(localStorage.getItem('historial_compras') || '[]');
      const resenasGuardadas = JSON.parse(localStorage.getItem('reseñas_peliculas') || '[]');

      this.peliculas = this.peliculas.map(p => {
        const nombrePeli = (p.nombre || p.titulo || '').toLowerCase();

        const califsHistorial = historial
          .filter((h: any) => (h.pelicula || '').toLowerCase() === nombrePeli && h.calificacion > 0)
          .map((h: any) => h.calificacion);

        const califsResenas = resenasGuardadas
          .filter((r: any) => (r.pelicula || '').toLowerCase() === nombrePeli && r.estrellas > 0)
          .map((r: any) => r.estrellas);

        const todasLasCalificaciones = [...califsHistorial, ...califsResenas];

        let promedio = 0;
        if (todasLasCalificaciones.length > 0) {
          const suma = todasLasCalificaciones.reduce((a, b) => a + b, 0);
          promedio = Math.round(suma / todasLasCalificaciones.length);
        } else if (p.rating || p.calificacion_promedio) {
          promedio = p.rating || p.calificacion_promedio;
        }

        return {
          ...p,
          rating: promedio
        };
      });

      // SECCIÓN PREVENTA: Películas marcadas en preventa o con estreno futuro que YA tienen funciones programadas
      this.peliculasPreventa = this.peliculas.filter(p => {
        const esPreventaFlag = p.es_preventa === true || p.preventa === true;
        const esEstrenoFuturo = p.fecha_estreno && p.fecha_estreno > hoy;
        const tieneFunciones = this.getFuncionesDePelicula(p.id).length > 0;

        return (esPreventaFlag || esEstrenoFuturo) && tieneFunciones;
      });

      if (typeof this.peliculasService.obtenerTopPeliculasMasVendidas === 'function') {
        this.topPeliculas = await this.peliculasService.obtenerTopPeliculasMasVendidas();
      }

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
      const esActiva = pelicula.activa !== false;
      const esEstrenada = !pelicula.fecha_estreno || pelicula.fecha_estreno <= hoy;
      
      if (!esActiva || !esEstrenada) return false;

      const nombrePeli = pelicula.nombre || pelicula.titulo || '';
      const coincideNombre = nombrePeli.toLowerCase().includes(this.textoBusqueda.toLowerCase().trim());

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
    const usuario = this.authService.usuarioActual();

    if (!usuario || !usuario.email) {
      this.mensajeModalAlerta = 'Debes iniciar sesión para activar las alertas de estreno.';
      this.mostrarModalAlerta = true;
      this.cdr.detectChanges();
      return;
    }

    try {
      await this.peliculasService.activarAlertaEstreno(pelicula.id, usuario.email);
      this.mensajeModalAlerta = `🔔 ¡Alerta activada! Te avisaremos cuando se habiliten las entradas para "${pelicula.nombre || pelicula.titulo}".`;
      this.mostrarModalAlerta = true;
    } catch (error) {
      console.error('Error al activar alerta:', error);
      this.mensajeModalAlerta = 'Ya tienes una alerta registrada para esta película o se produjo un error.';
      this.mostrarModalAlerta = true;
    } finally {
      this.cdr.detectChanges();
    }
  }

  cerrarModalAlerta() {
    this.mostrarModalAlerta = false;
    this.mensajeModalAlerta = '';
  }

  getFuncionesDePelicula(peliculaId: number) {
    return this.funciones.filter(f => Number(f.pelicula_id) === Number(peliculaId));
  }

  // Redirige al detalle de la película en la MISMA pestaña
  comprarEntradas(peliculaId: number) {
    this.router.navigate(['/pelicula', peliculaId]);
  }

  seleccionarFuncion(funcion: any) {
    localStorage.setItem('funcion_seleccionada', JSON.stringify(funcion));
    this.router.navigate(['/sala']);
  }

  verResenas(pelicula: any) {
    this.peliculaSeleccionadaModal = pelicula;
    this.nuevaResenaTexto = '';
    this.nuevaResenaEstrellas = 5;

    const nombrePeli = (pelicula.nombre || pelicula.titulo || '').toLowerCase();
    
    const todasLasResenas = JSON.parse(localStorage.getItem('reseñas_peliculas') || '[]');
    this.resenasModal = todasLasResenas.filter((r: any) => (r.pelicula || '').toLowerCase() === nombrePeli);

    this.mostrarModalResenas = true;
    this.cdr.detectChanges();
  }

  cerrarModalResenas() {
    this.mostrarModalResenas = false;
    this.peliculaSeleccionadaModal = null;
  }

  agregarResena() {
    if (!this.nuevaResenaTexto.trim()) return;

    const usuario = this.authService.usuarioActual();
    const autor = usuario ? `${usuario.nombre || 'Usuario'} ${usuario.apellido || ''}`.trim() : 'Usuario Anónimo';

    const nuevaResena = {
      pelicula: this.peliculaSeleccionadaModal.nombre || this.peliculaSeleccionadaModal.titulo,
      autor,
      comentario: this.nuevaResenaTexto.trim(),
      estrellas: this.nuevaResenaEstrellas,
      fecha: new Date().toISOString()
    };

    const todas = JSON.parse(localStorage.getItem('reseñas_peliculas') || '[]');
    todas.unshift(nuevaResena);
    localStorage.setItem('reseñas_peliculas', JSON.stringify(todas));

    this.resenasModal.unshift(nuevaResena);
    this.nuevaResenaTexto = '';

    this.cargarCartelera();
  }
}