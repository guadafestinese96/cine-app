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
  historialCanjes: CanjePuntos[] = [];
  mensajeCancelacion: string = '';
  mensajeCanje: string = '';

  // Catálogo de premios del programa de fidelización (RF-24)
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
    this.historialCanjes = this.authService.obtenerHistorialCanjes();
  }

  cargarHistorial() {
    const historial = localStorage.getItem('historial_compras');
    if (historial) {
      this.historialCompras = JSON.parse(historial);
    }
  }

  // RF-24: Realizar canje de puntos
  canjear(premio: { nombre: string; puntos: number }) {
    this.mensajeCanje = '';
    const exito = this.authService.canjearPuntos(premio.puntos, premio.nombre);

    if (exito) {
      this.mensajeCanje = `✅ ¡Canje exitoso! Canjeaste "${premio.nombre}" por ${premio.puntos} puntos. Presentá tu cupón en caja.`;
      this.usuario = this.authService.usuarioActual();
      this.historialCanjes = this.authService.obtenerHistorialCanjes();
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