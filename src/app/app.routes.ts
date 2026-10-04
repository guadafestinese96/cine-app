import { Routes } from '@angular/router';
import { CatalogoComponent } from './componentes/catalogo/catalogo';
import { RegistroComponent } from './componentes/registro/registro';
import { LoginComponent } from './componentes/login/login';
import { AdminComponent } from './componentes/admin/admin';
import { SalaComponent } from './componentes/sala/sala';
import { CandyComponent } from './componentes/candy/candy';
import { TicketComponent } from './componentes/ticket/ticket';
import { PerfilComponent } from './componentes/perfil/perfil';

export const routes: Routes = [
  { path: '', redirectTo: 'catalogo', pathMatch: 'full' }, // Si entra a la raíz, redirige al catálogo
  { path: 'catalogo', component: CatalogoComponent },
  { path: 'registro', component: RegistroComponent },
  { path: 'login', component: LoginComponent},
  { path: 'admin', component: AdminComponent},
  { path: 'sala', component: SalaComponent },
  { path: 'candy', component: CandyComponent },
  { path: 'ticket', component: TicketComponent },
  { path: 'perfil', component: PerfilComponent },
  { path: '**', redirectTo: 'catalogo' } // Cualquier ruta desconocida vuelve al catálogo
];