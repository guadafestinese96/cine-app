import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

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
  mensajeCancelacion: string = '';

  constructor(private router: Router, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.cargarUsuario();
    this.cargarHistorial();
  }

  cargarUsuario() {
    const usr = localStorage.getItem('usuario_logueado');
    if (usr) {
      this.usuario = JSON.parse(usr);
      if (this.usuario.credito_cuenta === undefined) {
        this.usuario.credito_cuenta = 0;
      }
    } else {
      this.router.navigate(['/login']);
    }
  }

  cargarHistorial() {
    const historial = localStorage.getItem('historial_compras');
    if (historial) {
      this.historialCompras = JSON.parse(historial);
    }
  }

  // RF-18: Calificación por estrellas
  calificar(item: CompraHistorial, estrellas: number) {
    item.calificacion = estrellas;
    this.guardarEnStorage();
    this.cdr.detectChanges();
  }

  // Guardar comentario y publicar en las reseñas públicas
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

  // RF-19: Cancelación con acreditación en cuenta hasta 2hs antes
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

    // Sumar el importe pagado al crédito en cuenta
    this.usuario.credito_cuenta = Number(this.usuario.credito_cuenta || 0) + Number(compra.monto || 0);

    localStorage.setItem('usuario_logueado', JSON.stringify(this.usuario));
    this.guardarEnStorage();

    this.mensajeCancelacion = `✅ Compra cancelada con éxito. Se han acreditado $${compra.monto} en tu saldo a favor.`;
    this.cdr.detectChanges();
  }
}