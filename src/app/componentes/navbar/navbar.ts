import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth';
import { ComprasService } from '../../services/compras';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class NavbarComponent {
  auth = inject(AuthService);
  compras = inject(ComprasService);
  menuAbierto = signal(false);

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menuAbierto.set(false));
  }

  iniciales(): string {
    const u = this.auth.usuarioActual();
    if (!u) return '';
    return ((u.nombre?.[0] ?? '') + (u.apellido?.[0] ?? '') || u.email[0]).toUpperCase();
  }

  cerrarSesion() {
    this.menuAbierto.set(false);
    this.auth.cerrarSesion();
  }
}
