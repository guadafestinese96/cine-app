import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

export interface CanjePuntos {
  id: string;
  concepto: string;
  puntosUtilizados: number;
  fecha: string;
}

export interface Usuario {
  id?: string;
  email: string;
  nombre?: string;
  apellido?: string;
  rol?: 'admin' | 'cliente' | string;
  es_admin?: boolean;
  fecha_nacimiento?: string;
  credito_cuenta?: number;
  puntos?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  usuarioActual = signal<Usuario | null>(this.obtenerUsuarioStorage());
  estaAutenticado = signal<boolean>(!!this.obtenerUsuarioStorage());

  constructor(private router: Router) {}

  private obtenerUsuarioStorage(): Usuario | null {
    const usr = localStorage.getItem('usuario_logueado');
    if (usr) {
      try {
        const usuario = JSON.parse(usr);
        const emailKey = usuario.email || 'defecto';

        // Cargar saldo de créditos
        const creditosGbl = JSON.parse(localStorage.getItem('creditos_usuarios') || '{}');
        usuario.credito_cuenta = creditosGbl[emailKey] ?? (usuario.credito_cuenta || 0);

        // Cargar puntos fidelidad (RF-24)
        const puntosGbl = JSON.parse(localStorage.getItem('puntos_fidelidad') || '{}');
        usuario.puntos = puntosGbl[emailKey] ?? (usuario.puntos || 0);

        return usuario;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  iniciarSesion(usuario: Usuario) {
    const emailKey = usuario.email || 'defecto';

    // Restaurar crédito y puntos
    const creditosGbl = JSON.parse(localStorage.getItem('creditos_usuarios') || '{}');
    usuario.credito_cuenta = creditosGbl[emailKey] ?? (usuario.credito_cuenta || 0);

    const puntosGbl = JSON.parse(localStorage.getItem('puntos_fidelidad') || '{}');
    usuario.puntos = puntosGbl[emailKey] ?? (usuario.puntos || 0);

    localStorage.setItem('usuario_logueado', JSON.stringify(usuario));
    this.usuarioActual.set(usuario);
    this.estaAutenticado.set(true);
  }

  // RF-24: Acumulación de puntos ($1 = 1 punto)
  sumarPuntos(monto: number) {
    const usuario = this.usuarioActual();
    if (!usuario) return;

    const emailKey = usuario.email || 'defecto';
    const puntosActuales = usuario.puntos || 0;
    const nuevosPuntos = puntosActuales + Math.floor(monto);

    usuario.puntos = nuevosPuntos;

    const puntosGbl = JSON.parse(localStorage.getItem('puntos_fidelidad') || '{}');
    puntosGbl[emailKey] = nuevosPuntos;

    localStorage.setItem('puntos_fidelidad', JSON.stringify(puntosGbl));
    localStorage.setItem('usuario_logueado', JSON.stringify(usuario));
    this.usuarioActual.set({ ...usuario });
  }

  // RF-24: Canje de puntos por premios
  canjearPuntos(costoPuntos: number, concepto: string): boolean {
    const usuario = this.usuarioActual();
    if (!usuario || (usuario.puntos || 0) < costoPuntos) {
      return false;
    }

    const emailKey = usuario.email || 'defecto';
    usuario.puntos = (usuario.puntos || 0) - costoPuntos;

    // Guardar nuevo saldo
    const puntosGbl = JSON.parse(localStorage.getItem('puntos_fidelidad') || '{}');
    puntosGbl[emailKey] = usuario.puntos;
    localStorage.setItem('puntos_fidelidad', JSON.stringify(puntosGbl));
    localStorage.setItem('usuario_logueado', JSON.stringify(usuario));

    // Registrar en el historial de canjes del usuario
    const historialCanjesGbl = JSON.parse(localStorage.getItem('historial_canjes') || '{}');
    const misCanjes: CanjePuntos[] = historialCanjesGbl[emailKey] || [];

    misCanjes.unshift({
      id: 'CANJE-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      concepto,
      puntosUtilizados: costoPuntos,
      fecha: new Date().toISOString()
    });

    historialCanjesGbl[emailKey] = misCanjes;
    localStorage.setItem('historial_canjes', JSON.stringify(historialCanjesGbl));

    this.usuarioActual.set({ ...usuario });
    return true;
  }

  obtenerHistorialCanjes(): CanjePuntos[] {
    const usuario = this.usuarioActual();
    if (!usuario) return [];
    const emailKey = usuario.email || 'defecto';
    const historialCanjesGbl = JSON.parse(localStorage.getItem('historial_canjes') || '{}');
    return historialCanjesGbl[emailKey] || [];
  }

  cerrarSesion() {
    localStorage.removeItem('usuario_logueado');
    localStorage.removeItem('descuento_aplicado');
    this.usuarioActual.set(null);
    this.estaAutenticado.set(false);
    this.router.navigate(['/login']);
  }

  esAdmin(): boolean {
    const u = this.usuarioActual();
    if (!u) return false;
    return u.rol === 'admin' || u.es_admin === true || u.email === 'admin@cineapp.com';
  }
}