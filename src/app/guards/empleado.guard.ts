import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

/** Empleados (y admins) pueden entrar al validador de QRs. */
export const empleadoGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.esperarInicio();
  if (!auth.estaAutenticado()) return router.createUrlTree(['/login'], { queryParams: { volver: state.url } });
  return auth.esEmpleado() ? true : router.createUrlTree(['/catalogo']);
};
