import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './componentes/navbar/navbar';
import { AvisosComponent } from './componentes/compartidos/avisos/avisos';
import { AuthService } from './services/auth';
import { NotificacionesService } from './services/notificaciones';
import { ConfiguracionService } from './services/configuracion';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, AvisosComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent {
  private auth = inject(AuthService);
  private notificaciones = inject(NotificacionesService);

  constructor() {
    inject(ConfiguracionService).cargar();
    // Cada vez que alguien inicia sesión se revisan sus alertas de estreno
    effect(() => {
      const usuario = this.auth.usuarioActual();
      if (usuario) this.notificaciones.revisar(usuario);
    });
  }
}
