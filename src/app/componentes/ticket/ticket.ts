import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ComprasService } from '../../services/compras';
import { TicketsService } from '../../services/tickets';
import { AuthService } from '../../services/auth';
import { AvisosService } from '../../services/avisos';
import { Compra } from '../../core/modelos';
import { clasificacionDe, edadMinima, errorLegible, formatearFuncion } from '../../core/utilidades';

@Component({
  selector: 'app-ticket',
  imports: [RouterLink, DatePipe],
  templateUrl: './ticket.html',
  styleUrl: './ticket.css',
})
export class TicketComponent {
  private compras = inject(ComprasService);
  private tickets = inject(TicketsService);
  private avisos = inject(AvisosService);
  auth = inject(AuthService);

  codigo = input.required<string>();
  nueva = input<string>();

  cargando = signal(true);
  compra = signal<Compra | null>(null);
  qr = signal('');
  descargando = signal(false);

  funcionTexto = computed(() => {
    const f = this.compra()?.funciones;
    return f ? formatearFuncion(f.fecha_hora) : '';
  });
  clasificacion = computed(() => clasificacionDe(this.compra()?.funciones?.peliculas));
  restriccion = computed(() => edadMinima(this.clasificacion()));
  compradorMenor = signal(false);
  requiereAdulto = computed(() => this.compradorMenor() || this.restriccion() > 0);
  textoAdulto = computed(() => {
    const c = this.compra();
    return c ? this.tickets.textoAdulto(c, this.compradorMenor()) : '';
  });
  candy = computed(() => [...(this.compra()?.combos ?? []), ...(this.compra()?.productos ?? [])]);

  async ngOnInit() {
    try {
      const compra = await this.compras.obtenerPorCodigo(this.codigo());
      this.compra.set(compra);
      if (compra) {
        this.qr.set(await this.tickets.qr(compra.codigo));
        this.compradorMenor.set(await this.tickets.compradorEsMenor(compra));
      }
    } catch (e) {
      this.avisos.error(errorLegible(e));
    } finally {
      this.cargando.set(false);
    }
  }

  async descargar() {
    const c = this.compra();
    if (!c) return;
    this.descargando.set(true);
    try {
      await this.tickets.descargarPdf(c);
    } catch (e) {
      this.avisos.error('No se pudo generar el PDF. ' + errorLegible(e));
    } finally {
      this.descargando.set(false);
    }
  }
}
