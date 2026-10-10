import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, CanjePuntos } from '../../services/auth';

interface CompraHistorial {
  id: string;
  pelicula: string;
  imagen_url?: string;
  sala: string;
  fecha_hora: string;
  monto: number;
  butacas: string[];
  calificacion?: number;
  comentario?: string;
  cancelada?: boolean;
  puntosGanados?: number;
}

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css'
})
export class PerfilComponent implements OnInit {
  usuario: any = null;
  historialCompras: CompraHistorial[] = [];
  historialCanjes: any[] = [];
  mensajeCancelacion: string = '';
  mensajeCanje: string = '';
  ultimoCuponGenerado: string = '';

  premiosPuntos = [
    { id: 1, nombre: '🥤 Gaseosa Mediana', puntos: 1500 },
    { id: 2, nombre: '🍿 Pochoclos Medianos', puntos: 2500 },
    { id: 3, nombre: '🎟️ 1 Entrada General Gratis', puntos: 5000 },
    { id: 4, nombre: '🥤🍿 Combo Pareja (2 Gaseosas + 1 Pochoclo Grande)', puntos: 8000 }
  ];

  constructor(
    public authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarUsuario();
    this.cargarHistorial();
  }

  cargarUsuario() {
    this.usuario = this.authService.usuarioActual();
    if (!this.usuario) {
      this.router.navigate(['/login']);
      return;
    }

    const emailKey = this.usuario.email || 'defecto';

    // Cargar puntos
    const puntosGlobales = JSON.parse(localStorage.getItem('puntos_fidelidad_usuarios') || '{}');
    if (puntosGlobales[emailKey] !== undefined) {
      this.usuario.puntos_fidelidad = puntosGlobales[emailKey];
      this.usuario.puntos = puntosGlobales[emailKey];
    } else if (this.usuario.puntos_fidelidad === undefined) {
      this.usuario.puntos_fidelidad = this.usuario.puntos || 0;
    }

    // Cargar historial de canjes del localStorage
    const canjesStorage = JSON.parse(localStorage.getItem('historial_canjes_puntos') || '[]');
    this.historialCanjes = canjesStorage.filter((c: any) => c.usuarioEmail === emailKey);
  }

  cargarHistorial() {
    const historial = localStorage.getItem('historial_compras');
    if (historial) {
      this.historialCompras = JSON.parse(historial);
    }
  }

  // RF-24: Realizar canje de puntos con generación de código de cupón
  canjear(premio: { nombre: string; puntos: number }) {
    this.mensajeCanje = '';
    this.ultimoCuponGenerado = '';
    const puntosActuales = Number(this.usuario?.puntos_fidelidad || this.usuario?.puntos || 0);

    if (puntosActuales >= premio.puntos) {
      const nuevosPuntos = puntosActuales - premio.puntos;
      
      this.usuario.puntos_fidelidad = nuevosPuntos;
      this.usuario.puntos = nuevosPuntos;

      // Generar código de cupón único
      const codigoCupon = 'CANJE-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      this.ultimoCuponGenerado = codigoCupon;

      // Guardar en usuario_logueado y en diccionario global de puntos
      localStorage.setItem('usuario_logueado', JSON.stringify(this.usuario));
      const puntosGlobales = JSON.parse(localStorage.getItem('puntos_fidelidad_usuarios') || '{}');
      const emailKey = this.usuario.email || 'defecto';
      puntosGlobales[emailKey] = nuevosPuntos;
      localStorage.setItem('puntos_fidelidad_usuarios', JSON.stringify(puntosGlobales));

      // Registro de canje en historial
      const nuevoCanje = {
        id: codigoCupon,
        premio: premio.nombre,
        puntos: premio.puntos,
        fecha: new Date().toISOString(),
        usuarioEmail: emailKey,
        codigoCupon: codigoCupon
      };

      const todosLosCanjes = JSON.parse(localStorage.getItem('historial_canjes_puntos') || '[]');
      todosLosCanjes.unshift(nuevoCanje);
      localStorage.setItem('historial_canjes_puntos', JSON.stringify(todosLosCanjes));

      this.historialCanjes.unshift(nuevoCanje);
      this.mensajeCanje = `✅ ¡Canje exitoso! Presentá el cupón ${codigoCupon} en caja para retirar "${premio.nombre}".`;
    } else {
      this.mensajeCanje = `❌ No tenés suficientes puntos para canjear "${premio.nombre}".`;
    }
    this.cdr.detectChanges();
  }

  calificar(item: CompraHistorial, estrellas: number) {
    item.calificacion = estrellas;
    this.guardarEnStorage();
    this.cdr.detectChanges();
  }

  guardarComentario(item: CompraHistorial) {
    this.guardarEnStorage();

    const resenasExistentes = JSON.parse(localStorage.getItem('reseñas_peliculas') || '[]');
    const nuevaResena = {
      pelicula: item.pelicula,
      autor: `${this.usuario?.nombre || 'Usuario'} ${this.usuario?.apellido || ''}`.trim(),
      comentario: item.comentario || '',
      estrellas: item.calificacion || 5,
      fecha: new Date().toISOString(),
      compraId: item.id
    };

    const indicePrevio = resenasExistentes.findIndex((r: any) => r.compraId === item.id);
    if (indicePrevio !== -1) {
      resenasExistentes[indicePrevio] = nuevaResena;
    } else {
      resenasExistentes.unshift(nuevaResena);
    }

    localStorage.setItem('reseñas_peliculas', JSON.stringify(resenasExistentes));
    this.mensajeCancelacion = '✅ ¡Tu reseña y puntuación fueron guardadas correctamente!';
    this.cdr.detectChanges();
  }

  private guardarEnStorage() {
    localStorage.setItem('historial_compras', JSON.stringify(this.historialCompras));
  }

  puedeCancelar(fechaHora: string): boolean {
    if (!fechaHora) return false;
    const ahora = new Date().getTime();
    const funcionTime = new Date(fechaHora).getTime();
    const dosHorasEnMs = 2 * 60 * 60 * 1000;

    return (funcionTime - ahora) >= dosHorasEnMs;
  }

  cancelarCompra(compra: CompraHistorial) {
    this.mensajeCancelacion = '';

    if (!this.puedeCancelar(compra.fecha_hora)) {
      this.mensajeCancelacion = '❌ Las cancelaciones solo están permitidas hasta 2 horas antes de la función.';
      return;
    }

    compra.cancelada = true;

    const nuevoCredito = Number(this.usuario.credito_cuenta || 0) + Number(compra.monto || 0);
    this.usuario.credito_cuenta = nuevoCredito;

    const creditosGbl = JSON.parse(localStorage.getItem('creditos_usuarios') || '{}');
    const emailKey = this.usuario.email || 'defecto';
    creditosGbl[emailKey] = nuevoCredito;

    localStorage.setItem('creditos_usuarios', JSON.stringify(creditosGbl));
    localStorage.setItem('usuario_logueado', JSON.stringify(this.usuario));
    this.guardarEnStorage();

    this.mensajeCancelacion = `✅ Compra cancelada con éxito. Se han acreditado $${compra.monto} en tu saldo a favor.`;
    this.cdr.detectChanges();
  }
}