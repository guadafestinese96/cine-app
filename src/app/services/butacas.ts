import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase';
import { ConfiguracionService } from './configuracion';
import { Asiento } from './sala';
import { obtenerSessionId } from '../guards/session.guard';

export interface EstadoButacas {
  /** Reservadas por esta pestaña */
  mias: Set<string>;
  /** Vendidas o reservadas por otra persona */
  ocupadas: Set<string>;
  /** Momento en que vencen mis reservas */
  vencimiento: Date | null;
}

/**
 * Reservas temporales de butacas en tiempo real.
 * Al tocar una butaca se guarda como 'reservada' por N minutos; al pagar pasa a 'vendida'.
 * Si alguien abandona la compra, la reserva vence sola y la butaca vuelve a estar libre.
 */
@Injectable({ providedIn: 'root' })
export class ButacasService {
  private sb = inject(SupabaseService).client;
  private config = inject(ConfiguracionService);

  get sessionId(): string {
    return obtenerSessionId();
  }

  async estado(funcionId: number): Promise<EstadoButacas> {
    const { data, error } = await this.sb
      .from('butacas_ocupadas')
      .select('fila, numero, session_id, estado, expira_en')
      .eq('funcion_id', funcionId);
    if (error) throw error;

    const ahora = Date.now();
    const mias = new Set<string>();
    const ocupadas = new Set<string>();
    let vencimiento: Date | null = null;

    for (const b of data ?? []) {
      const id = `${b.fila}${b.numero}`;
      const vendida = !b.estado || b.estado === 'vendida';
      const vigente = vendida || !b.expira_en || new Date(b.expira_en).getTime() > ahora;
      if (!vigente) continue;
      if (!vendida && b.session_id === this.sessionId) {
        mias.add(id);
        const vence = b.expira_en ? new Date(b.expira_en) : null;
        if (vence && (!vencimiento || vence < vencimiento)) vencimiento = vence;
      } else {
        ocupadas.add(id);
      }
    }
    return { mias, ocupadas, vencimiento };
  }

  private vencimientoNuevo(): string {
    const minutos = this.config.valores().minutos_reserva || 10;
    return new Date(Date.now() + minutos * 60_000).toISOString();
  }

  async reservar(funcionId: number, asiento: Asiento, email?: string | null) {
    // Si había una reserva vencida en esa butaca, se libera primero
    await this.sb
      .from('butacas_ocupadas')
      .delete()
      .eq('funcion_id', funcionId)
      .eq('fila', asiento.fila)
      .eq('numero', asiento.numero)
      .eq('estado', 'reservada')
      .lt('expira_en', new Date().toISOString());

    const { error } = await this.sb.from('butacas_ocupadas').insert([
      {
        funcion_id: funcionId,
        fila: asiento.fila,
        numero: asiento.numero,
        session_id: this.sessionId,
        usuario_email: email ?? null,
        estado: 'reservada',
        expira_en: this.vencimientoNuevo(),
      },
    ]);
    if (error) {
      if (error.code === '23505') throw new Error(`La butaca ${asiento.id} la acaba de elegir otra persona.`);
      throw error;
    }
  }

  async liberar(funcionId: number, asiento: Pick<Asiento, 'fila' | 'numero'>) {
    const { error } = await this.sb
      .from('butacas_ocupadas')
      .delete()
      .eq('funcion_id', funcionId)
      .eq('fila', asiento.fila)
      .eq('numero', asiento.numero)
      .eq('session_id', this.sessionId)
      .eq('estado', 'reservada');
    if (error) throw error;
  }

  async liberarTodas(funcionId: number) {
    await this.sb
      .from('butacas_ocupadas')
      .delete()
      .eq('funcion_id', funcionId)
      .eq('session_id', this.sessionId)
      .eq('estado', 'reservada');
  }

  /** Extiende el tiempo de reserva (al pasar al pago). */
  async renovar(funcionId: number) {
    await this.sb
      .from('butacas_ocupadas')
      .update({ expira_en: this.vencimientoNuevo() })
      .eq('funcion_id', funcionId)
      .eq('session_id', this.sessionId)
      .eq('estado', 'reservada');
  }

  /** Convierte mis reservas en butacas vendidas. Falla si alguna reserva ya venció y se perdió. */
  async confirmar(funcionId: number, cantidadEsperada: number, codigoCompra: string) {
    const { data, error } = await this.sb
      .from('butacas_ocupadas')
      .update({ estado: 'vendida', compra_id: codigoCompra, expira_en: null })
      .eq('funcion_id', funcionId)
      .eq('session_id', this.sessionId)
      .eq('estado', 'reservada')
      .select('fila');
    if (error) throw error;
    if ((data?.length ?? 0) < cantidadEsperada) {
      throw new Error('Tu reserva de butacas venció. Volvé a elegirlas para completar la compra.');
    }
  }

  async liberarDeCompra(codigoCompra: string) {
    const { error } = await this.sb.from('butacas_ocupadas').delete().eq('compra_id', codigoCompra);
    if (error) throw error;
  }

  /** Avisa ante cualquier cambio en las butacas de esa función. Devuelve la función para desuscribirse. */
  escuchar(funcionId: number, alCambiar: () => void): () => void {
    const canal: RealtimeChannel = this.sb
      .channel(`butacas-${funcionId}-${this.sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'butacas_ocupadas' }, (payload: any) => {
        const id = payload.new?.funcion_id ?? payload.old?.funcion_id;
        if (id === undefined || Number(id) === Number(funcionId)) alCambiar();
      })
      .subscribe();
    return () => {
      this.sb.removeChannel(canal);
    };
  }
}
