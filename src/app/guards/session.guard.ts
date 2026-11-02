import { CanActivateFn } from '@angular/router';

/**
 * Asegura que la pestaña tenga un identificador de sesión anónimo.
 * Se usa para saber qué butacas reservó "esta" pestaña en el mapa en tiempo real,
 * incluso si el usuario compra sin registrarse.
 */
export const sessionGuard: CanActivateFn = () => {
  obtenerSessionId();
  return true;
};

export function obtenerSessionId(): string {
  let id: string | null = null;
  try {
    id = sessionStorage.getItem('cine_session_id');
    if (!id) {
      id = 'sess-' + crypto.randomUUID();
      sessionStorage.setItem('cine_session_id', id);
    }
  } catch {
    id = id ?? 'sess-' + crypto.randomUUID();
  }
  return id;
}
