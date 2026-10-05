import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Si ni siquiera está logueado, al login
  if (!authService.estaAutenticado()) {
    router.navigate(['/login']);
    return false;
  }

  // Si está logueado y es admin, entra
  if (authService.esAdmin()) {
    return true;
  }

  // Requisito 7: Si no es admin, redirigir a /catalogo (o /home)
  router.navigate(['/catalogo']);
  return false;
};