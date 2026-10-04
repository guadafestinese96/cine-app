import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class NavbarComponent implements OnInit {
  usuarioLogueado: any = null;
  isMenuOpen: boolean = false;

  constructor(private router: Router, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.verificarUsuario();

    // Actualiza el estado del usuario cada vez que cambia de vista o redirige
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.verificarUsuario();
        this.isMenuOpen = false; // Cierra el menú al cambiar de ruta
      });
  }

  verificarUsuario() {
    const usrStorage = localStorage.getItem('usuario_logueado');
    if (usrStorage) {
      try {
        this.usuarioLogueado = JSON.parse(usrStorage);
      } catch (e) {
        this.usuarioLogueado = null;
      }
    } else {
      this.usuarioLogueado = null;
    }
    this.cdr.detectChanges();
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  cerrarSesion() {
    this.isMenuOpen = false;
    localStorage.removeItem('usuario_logueado');
    this.usuarioLogueado = null;
    this.router.navigate(['/login']);
  }
}