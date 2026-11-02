import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';
import { ActividadService } from './actividad';
import { Rol, Usuario } from '../core/modelos';

/** Gestión de cuentas desde el admin: alta de empleados y administradores cambiando el rol. */
@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private sb = inject(SupabaseService).client;
  private actividad = inject(ActividadService);

  async listar(): Promise<Usuario[]> {
    const { data, error } = await this.sb.from('usuarios').select('*').order('apellido');
    if (error) throw error;
    return (data ?? []).map((u) => ({ ...u, rol: u.rol ?? 'cliente', puntos: Number(u.puntos ?? 0), credito: Number(u.credito ?? 0) }));
  }

  async cambiarRol(usuario: Usuario, rol: Rol) {
    const { error } = await this.sb.from('usuarios').update({ rol }).eq('id', usuario.id);
    if (error) throw error;
    await this.actividad.registrar('Cambió rol de usuario', `${usuario.email}: ${usuario.rol} → ${rol}`);
  }
}
