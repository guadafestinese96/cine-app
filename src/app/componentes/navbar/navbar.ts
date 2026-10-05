import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class NavbarComponent implements OnInit {
  isMenuOpen: boolean = false;

  constructor(public authService: AuthService, private router: Router) {}

  ngOnInit() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.isMenuOpen = false;
      });
  }

  // Getter que obtiene el valor de la Signal o null
  get usuarioLogueado() {
    return this.authService.usuarioActual();
  }

  get esAdmin(): boolean {
    return this.authService.esAdmin();
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  cerrarSesion() {
    this.isMenuOpen = false;
    this.authService.cerrarSesion();
  }
}