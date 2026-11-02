import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { AdminReportesComponent } from './reportes/admin-reportes';
import { AdminPeliculasComponent } from './peliculas/admin-peliculas';
import { AdminFuncionesComponent } from './funciones/admin-funciones';
import { AdminSalasComponent } from './salas/admin-salas';
import { AdminCandyComponent } from './candy/admin-candy';
import { AdminBeneficiosComponent } from './beneficios/admin-beneficios';
import { AdminUsuariosComponent } from './usuarios/admin-usuarios';
import { AdminActividadComponent } from './actividad/admin-actividad';

const SECCIONES = [
  { id: 'reportes', nombre: 'Reportes' },
  { id: 'peliculas', nombre: 'Películas' },
  { id: 'funciones', nombre: 'Funciones' },
  { id: 'salas', nombre: 'Salas' },
  { id: 'candy', nombre: 'Candy y combos' },
  { id: 'beneficios', nombre: 'Precios y beneficios' },
  { id: 'usuarios', nombre: 'Usuarios' },
  { id: 'actividad', nombre: 'Actividad' },
] as const;

type Seccion = (typeof SECCIONES)[number]['id'];

/** Panel de administración: cada pestaña es un componente independiente. */
@Component({
  selector: 'app-admin',
  imports: [
    AdminReportesComponent,
    AdminPeliculasComponent,
    AdminFuncionesComponent,
    AdminSalasComponent,
    AdminCandyComponent,
    AdminBeneficiosComponent,
    AdminUsuariosComponent,
    AdminActividadComponent,
  ],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class AdminComponent {
  private router = inject(Router);
  readonly secciones = SECCIONES;

  seccion = input<string>();
  activa = computed<Seccion>(() => (SECCIONES.find((s) => s.id === this.seccion())?.id ?? 'reportes') as Seccion);

  ir(id: Seccion) {
    this.router.navigate([], { queryParams: { seccion: id }, replaceUrl: true });
  }
}
