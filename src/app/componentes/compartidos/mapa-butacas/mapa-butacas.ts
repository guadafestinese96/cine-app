import { Component, input, output } from '@angular/core';
import { Asiento, FilaSala } from '../../../services/sala';

export type EstadoAsiento = 'libre' | 'mia' | 'ocupada' | 'bloqueada';

/**
 * Plano de la sala. Lo usan el cliente (elige butacas) y el admin (marca butacas fuera de servicio).
 * Cada butaca es un botón con descripción para lectores de pantalla.
 */
@Component({
  selector: 'app-mapa-butacas',
  templateUrl: './mapa-butacas.html',
  styleUrl: './mapa-butacas.css',
})
export class MapaButacasComponent {
  plano = input.required<FilaSala[]>();
  mias = input<Set<string>>(new Set());
  ocupadas = input<Set<string>>(new Set());
  bloqueadas = input<string[]>([]);
  modo = input<'cliente' | 'admin'>('cliente');
  ocupado = input(false);

  tocar = output<Asiento>();

  estado(a: Asiento): EstadoAsiento {
    if (this.bloqueadas().includes(a.id)) return 'bloqueada';
    if (this.mias().has(a.id)) return 'mia';
    if (this.ocupadas().has(a.id)) return 'ocupada';
    return 'libre';
  }

  deshabilitada(a: Asiento): boolean {
    if (this.modo() === 'admin') return this.ocupadas().has(a.id);
    const e = this.estado(a);
    return this.ocupado() || e === 'ocupada' || e === 'bloqueada';
  }

  descripcion(a: Asiento): string {
    const tipo = a.tipo === 'vip' ? ', VIP' : a.tipo === 'adaptada' ? ', accesible para silla de ruedas' : '';
    const estados: Record<EstadoAsiento, string> = {
      libre: 'libre',
      mia: 'seleccionada',
      ocupada: 'ocupada',
      bloqueada: 'fuera de servicio',
    };
    return `Fila ${a.fila}, butaca ${a.numero}${tipo}: ${estados[this.estado(a)]}`;
  }
}
