import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';
import { AuthService } from './auth';
import { LogActividad } from '../core/modelos';

/** Log de actividad del panel de administración: quién hizo qué y cuándo. */
@Injectable({ providedIn: 'root' })
export class ActividadService {
  private sb = inject(SupabaseService).client;
  private auth = inject(AuthService);

  async registrar(accion: string, detalle = '') {
    const { error } = await this.sb.from('logs_actividad').insert([
      { usuario_email: this.auth.usuarioActual()?.email ?? 'anónimo', accion, detalle },
    ]);
    if (error) console.warn('No se pudo registrar la actividad', error);
  }

  async listar(limite = 200): Promise<LogActividad[]> {
    const { data, error } = await this.sb
      .from('logs_actividad')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limite);
    if (error) throw error;
    return data ?? [];
  }
}
