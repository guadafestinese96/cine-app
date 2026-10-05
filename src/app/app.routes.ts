import { Routes } from '@angular/router';
import { CatalogoComponent } from './componentes/catalogo/catalogo';
import { RegistroComponent } from './componentes/registro/registro';
import { LoginComponent } from './componentes/login/login';
import { AdminComponent } from './componentes/admin/admin';
import { SalaComponent } from './componentes/sala/sala';
import { CandyComponent } from './componentes/candy/candy';
import { TicketComponent } from './componentes/ticket/ticket';
import { PerfilComponent } from './componentes/perfil/perfil';

// Guards de autenticación y rol
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'catalogo', pathMatch: 'full' },
  { path: 'catalogo', component: CatalogoComponent },
  { path: 'registro', component: RegistroComponent },
  { path: 'login', component: LoginComponent },
  { path: 'sala', component: SalaComponent },
  { path: 'candy', component: CandyComponent },
  { path: 'ticket', component: TicketComponent },

  // Rutas protegidas
  { path: 'perfil', component: PerfilComponent, canActivate: [authGuard] }, // Requiere inicio de sesión
  { path: 'admin', component: AdminComponent, canActivate: [adminGuard] }, // Exclusivo para el rol administrador

  { path: '**', redirectTo: 'catalogo' }
];