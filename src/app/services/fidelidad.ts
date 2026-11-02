import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';
import { ActividadService } from './actividad';
import { AuthService } from './auth';
import { Canje, Recompensa } from '../core/modelos';

/**
 * Programa de puntos: 1 punto por cada peso pagado (solo usuarios registrados).
 * Los puntos se canjean por recompensas cuyo costo configura el admin.
 * Los puntos son personales: no existe ninguna operación para transferirlos.
 */
@Injectable({ providedIn: 'root' })
export class FidelidadService {
  private sb = inject(SupabaseService).client;
  private actividad = inject(ActividadService);
  private auth = inject(AuthService);

  async recompensas(incluirInactivas = false): Promise<Recompensa[]> {
    let consulta = this.sb.from('recompensas').select('*').order('puntos');
    if (!incluirInactivas) consulta = consulta.eq('activa', true);
    const { data, error } = await consulta;
    if (error) throw error;
    return data ?? [];
  }

  async guardarRecompensa(r: Recompensa) {
    const datos = { nombre: r.nombre, tipo: r.tipo, puntos: Number(r.puntos), activa: r.activa };
    if (r.id) {
      const { data: anterior } = await this.sb.from('recompensas').select('puntos').eq('id', r.id).maybeSingle();
      const { error } = await this.sb.from('recompensas').update(datos).eq('id', r.id);
      if (error) throw error;
      const cambio = anterior && anterior.puntos !== datos.puntos ? ` (${anterior.puntos} → ${datos.puntos} pts)` : '';
      await this.actividad.registrar('Editó recompensa', `${datos.nombre}${cambio}`);
    } else {
      const { error } = await this.sb.from('recompensas').insert([datos]);
      if (error) throw error;
      await this.actividad.registrar('Creó recompensa', `${datos.nombre} (${datos.puntos} pts)`);
    }
  }

  /** El descuento de puntos y el alta del canje ocurren juntos en la base (función SQL). */
  async canjear(recompensa: Recompensa): Promise<string> {
    const usuario = this.auth.usuarioActual();
    if (!usuario) throw new Error('Iniciá sesión para canjear puntos.');
    const { data, error } = await this.sb.rpc('canjear_recompensa', {
      p_usuario: usuario.id,
      p_recompensa: recompensa.id,
    });
    if (error) throw new Error(error.message);
    await this.auth.refrescar();
    return data as string;
  }

  async misCanjes(): Promise<Canje[]> {
    const usuario = this.auth.usuarioActual();
    if (!usuario) return [];
    const { data, error } = await this.sb
      .from('canjes')
      .select('*')
      .eq('usuario_id', usuario.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  /** Canjes de entrada sin usar del usuario actual (para aplicar en el pago). */
  async entradasGratisDisponibles(): Promise<Canje[]> {
    return (await this.misCanjes()).filter((c) => c.tipo === 'entrada' && !c.usado);
  }

  async marcarUsado(codigo: string) {
    const { data, error } = await this.sb
      .from('canjes')
      .update({ usado: true, usado_at: new Date().toISOString() })
      .eq('codigo', codigo)
      .eq('usado', false)
      .select('codigo');
    if (error) throw error;
    if (!data?.length) throw new Error(`El canje ${codigo} ya fue usado.`);
  }
}
