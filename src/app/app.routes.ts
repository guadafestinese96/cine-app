import { Routes } from '@angular/router';
import { CatalogoComponent } from './componentes/catalogo/catalogo';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { empleadoGuard } from './guards/empleado.guard';
import { sessionGuard } from './guards/session.guard';

// La cartelera se carga de entrada; el resto de las pantallas se carga bajo demanda (lazy loading).
export const routes: Routes = [
  { path: '', redirectTo: 'catalogo', pathMatch: 'full' },
  { path: 'catalogo', component: CatalogoComponent, title: 'CineWidi · Cartelera' },
  {
    path: 'pelicula/:id',
    loadComponent: () => import('./componentes/detalle-pelicula/detalle-pelicula').then((m) => m.DetallePelicula),
    title: 'CineWidi · Película',
  },
  {
    path: 'sala/:funcionId',
    loadComponent: () => import('./componentes/sala/sala').then((m) => m.SalaComponent),
    canActivate: [sessionGuard],
    title: 'CineWidi · Elegí tus butacas',
  },
  {
    path: 'candy',
    loadComponent: () => import('./componentes/candy/candy').then((m) => m.CandyComponent),
    canActivate: [sessionGuard],
    title: 'CineWidi · Candy bar',
  },
  {
    path: 'pago',
    loadComponent: () => import('./componentes/pago/pago').then((m) => m.PagoComponent),
    canActivate: [sessionGuard],
    title: 'CineWidi · Pago',
  },
  {
    path: 'ticket/:codigo',
    loadComponent: () => import('./componentes/ticket/ticket').then((m) => m.TicketComponent),
    title: 'CineWidi · Tu entrada',
  },
  {
    path: 'login',
    loadComponent: () => import('./componentes/login/login').then((m) => m.LoginComponent),
    title: 'CineWidi · Ingresar',
  },
  {
    path: 'registro',
    loadComponent: () => import('./componentes/registro/registro').then((m) => m.RegistroComponent),
    title: 'CineWidi · Crear cuenta',
  },
  {
    path: 'perfil',
    loadComponent: () => import('./componentes/perfil/perfil').then((m) => m.PerfilComponent),
    canActivate: [authGuard],
    title: 'CineWidi · Mi cuenta',
  },
  {
    path: 'validar',
    loadComponent: () => import('./componentes/validar/validar').then((m) => m.ValidarComponent),
    canActivate: [empleadoGuard],
    title: 'CineWidi · Validar QR',
  },
  {
    path: 'admin',
    loadComponent: () => import('./componentes/admin/admin').then((m) => m.AdminComponent),
    canActivate: [adminGuard],
    title: 'CineWidi · Administración',
  },
  { path: '**', redirectTo: 'catalogo' },
];
