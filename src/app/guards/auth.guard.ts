import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

/** Solo usuarios con sesión iniciada. Vuelve a la página pedida después del login. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.esperarInicio();
  if (auth.estaAutenticado()) return true;
  return router.createUrlTree(['/login'], { queryParams: { volver: state.url } });
};
