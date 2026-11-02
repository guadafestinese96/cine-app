import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

/** Solo administradores. Un cliente logueado vuelve a la cartelera. */
export const adminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.esperarInicio();
  if (!auth.estaAutenticado()) return router.createUrlTree(['/login'], { queryParams: { volver: state.url } });
  return auth.esAdmin() ? true : router.createUrlTree(['/catalogo']);
};
