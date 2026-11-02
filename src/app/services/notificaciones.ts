import { Injectable, inject } from '@angular/core';
import { PeliculasService } from './peliculas';
import { AvisosService } from './avisos';
import { Usuario } from '../core/modelos';

/**
 * Alertas de "Próximamente": cuando una película con alerta activada ya tiene entradas a la venta,
 * se avisa con un mensaje en la app y, si el usuario lo permitió, con una notificación del sistema.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private peliculas = inject(PeliculasService);
  private avisos = inject(AvisosService);

  async pedirPermiso() {
    try {
      if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    } catch {
      /* el navegador no soporta notificaciones */
    }
  }

  async revisar(usuario: Usuario | null) {
    if (!usuario?.email) return;
    const listas = await this.peliculas.alertasListas(usuario.email);
    for (const p of listas) {
      const texto = `Ya están a la venta las entradas de "${p.nombre}".`;
      this.avisos.mostrar(texto, 'info', 9000);
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('CineWidi', { body: texto, icon: 'assets/icons/icon-192x192.png' });
        }
      } catch {
        /* algunos navegadores móviles solo permiten notificaciones desde el service worker */
      }
    }
  }
}
