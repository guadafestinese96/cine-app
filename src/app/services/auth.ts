import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase';
import { Rol, Usuario } from '../core/modelos';

export interface DatosRegistro {
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  tipo_sangre: string;
  color_ojos: string;
  dias_vacaciones: number;
}

/**
 * Estado global de sesión con Signals.
 * La sesión la maneja Supabase Auth; el perfil (rol, puntos, crédito) vive en la tabla `usuarios`.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private sb = inject(SupabaseService).client;
  private router = inject(Router);

  readonly usuarioActual = signal<Usuario | null>(null);
  readonly listo = signal(false);
  readonly estaAutenticado = computed(() => !!this.usuarioActual());
  readonly rol = computed<Rol | null>(() => this.usuarioActual()?.rol ?? null);
  readonly esAdmin = computed(() => this.rol() === 'admin');
  /** Los admins también pueden validar QRs */
  readonly esEmpleado = computed(() => this.rol() === 'empleado' || this.rol() === 'admin');

  private readonly inicio: Promise<void>;

  constructor() {
    this.inicio = this.restaurarSesion();
    this.sb.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_OUT') this.usuarioActual.set(null);
    });
  }

  /** Los guards esperan a que se restaure la sesión antes de decidir. */
  esperarInicio(): Promise<void> {
    return this.inicio;
  }

  private async restaurarSesion() {
    try {
      const { data } = await this.sb.auth.getSession();
      const user = data.session?.user;
      if (user) await this.cargarPerfil(user.id, user.email ?? '');
    } catch (e) {
      console.error('No se pudo restaurar la sesión', e);
    } finally {
      this.listo.set(true);
    }
  }

  private async cargarPerfil(id: string, email: string): Promise<Usuario> {
    const { data } = await this.sb.from('usuarios').select('*').eq('id', id).maybeSingle();
    const usuario = this.normalizar(data ?? { id, email });
    this.usuarioActual.set(usuario);
    return usuario;
  }

  private normalizar(d: any): Usuario {
    const rolLegacy = d.es_admin === true || d.email === 'admin@cineapp.com' ? 'admin' : 'cliente';
    return {
      id: d.id,
      email: d.email ?? '',
      nombre: d.nombre ?? '',
      apellido: d.apellido ?? '',
      fecha_nacimiento: d.fecha_nacimiento ?? null,
      tipo_sangre: d.tipo_sangre ?? null,
      color_ojos: d.color_ojos ?? null,
      dias_vacaciones: d.dias_vacaciones ?? null,
      rol: (d.rol && d.rol !== 'cliente' ? d.rol : rolLegacy) as Rol,
      puntos: Number(d.puntos ?? 0),
      credito: Number(d.credito ?? 0),
    };
  }

  async iniciarSesion(email: string, password: string): Promise<Usuario> {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(this.traducirError(error.message));
    return this.cargarPerfil(data.user.id, data.user.email ?? email);
  }

  /** Devuelve true si quedó con la sesión iniciada (cuando Supabase no exige confirmar el mail). */
  async registrar(email: string, password: string, datos: DatosRegistro): Promise<boolean> {
    const { data, error } = await this.sb.auth.signUp({ email, password });
    if (error) throw new Error(this.traducirError(error.message));
    if (!data.user) throw new Error('No se pudo crear la cuenta.');

    const { error: errorPerfil } = await this.sb.from('usuarios').insert([
      { id: data.user.id, email, ...datos, rol: 'cliente', puntos: 0, credito: 0 },
    ]);
    if (errorPerfil) throw new Error(errorPerfil.message);

    if (data.session) {
      await this.cargarPerfil(data.user.id, email);
      return true;
    }
    return false;
  }

  async cerrarSesion() {
    await this.sb.auth.signOut();
    this.usuarioActual.set(null);
    this.router.navigate(['/catalogo']);
  }

  /** Vuelve a leer puntos y crédito desde la base. */
  async refrescar() {
    const u = this.usuarioActual();
    if (u) await this.cargarPerfil(u.id, u.email);
  }

  actualizarSaldos(puntos: number, credito: number) {
    const u = this.usuarioActual();
    if (u) this.usuarioActual.set({ ...u, puntos: Number(puntos), credito: Number(credito) });
  }

  async actualizarPerfil(cambios: Partial<Usuario>) {
    const u = this.usuarioActual();
    if (!u) return;
    const { error } = await this.sb.from('usuarios').update(cambios).eq('id', u.id);
    if (error) throw error;
    this.usuarioActual.set({ ...u, ...cambios });
  }

  /** Destino por defecto según el rol después de iniciar sesión */
  rutaInicial(): string {
    const rol = this.rol();
    if (rol === 'admin') return '/admin';
    if (rol === 'empleado') return '/validar';
    return '/catalogo';
  }

  private traducirError(mensaje: string): string {
    if (/invalid login credentials/i.test(mensaje)) return 'El mail o la contraseña no coinciden.';
    if (/email not confirmed/i.test(mensaje)) return 'Confirmá tu mail desde el enlace que te enviamos antes de ingresar.';
    if (/already registered/i.test(mensaje)) return 'Ya existe una cuenta con ese mail.';
    if (/password should be/i.test(mensaje)) return 'La contraseña tiene que tener al menos 6 caracteres.';
    return mensaje;
  }
}
