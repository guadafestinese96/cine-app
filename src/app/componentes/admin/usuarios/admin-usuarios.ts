import { Component, computed, inject, signal } from '@angular/core';
import { UsuariosService } from '../../../services/usuarios';
import { AuthService } from '../../../services/auth';
import { AvisosService } from '../../../services/avisos';
import { Rol, Usuario } from '../../../core/modelos';
import { calcularEdad, errorLegible } from '../../../core/utilidades';

/** Alta de empleados y administradores: la persona se registra y acá se le asigna el rol. */
@Component({
  selector: 'app-admin-usuarios',
  template: `
    <p class="texto-suave intro">
      Para sumar un empleado, pedile que cree su cuenta desde "Crear cuenta" y después asignale el rol acá.
      Los empleados solo ven el validador de QR; los administradores, todo el panel.
    </p>
    <div class="campo buscador">
      <input class="entrada" type="search" placeholder="Buscar por nombre o mail" aria-label="Buscar usuario"
        [value]="busqueda()" (input)="busqueda.set($any($event.target).value)" />
    </div>
    <div class="tabla-envoltura">
      <table class="tabla">
        <thead>
          <tr><th>Nombre</th><th>Mail</th><th class="num">Edad</th><th class="num">Puntos</th><th class="num">Crédito</th><th>Rol</th></tr>
        </thead>
        <tbody>
          @for (u of filtrados(); track u.id) {
            <tr>
              <td>{{ u.nombre }} {{ u.apellido }}</td>
              <td>{{ u.email }}</td>
              <td class="num">{{ edad(u) ?? '—' }}</td>
              <td class="num">{{ u.puntos }}</td>
              <td class="num">\${{ u.credito }}</td>
              <td>
                <div class="fichas roles">
                  @for (r of roles; track r.valor) {
                    <button type="button" class="ficha" [class.activa]="u.rol === r.valor"
                      [disabled]="u.id === auth.usuarioActual()?.id" (click)="cambiar(u, r.valor)">{{ r.nombre }}</button>
                  }
                </div>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="texto-suave">No hay usuarios que coincidan.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .intro { margin-bottom: 16px; max-width: 70ch; }
    .buscador { max-width: 380px; }
    .roles { flex-wrap: nowrap; }
    .roles .ficha { min-height: 30px; padding: 4px 10px; font-size: 0.8rem; }
  `,
})
export class AdminUsuariosComponent {
  private srv = inject(UsuariosService);
  private avisos = inject(AvisosService);
  auth = inject(AuthService);

  readonly roles: { valor: Rol; nombre: string }[] = [
    { valor: 'cliente', nombre: 'Cliente' },
    { valor: 'empleado', nombre: 'Empleado' },
    { valor: 'admin', nombre: 'Admin' },
  ];

  usuarios = signal<Usuario[]>([]);
  busqueda = signal('');
  filtrados = computed(() => {
    const t = this.busqueda().toLowerCase().trim();
    return this.usuarios().filter((u) => !t || `${u.nombre} ${u.apellido} ${u.email}`.toLowerCase().includes(t));
  });

  constructor() {
    this.cargar();
  }

  async cargar() {
    try {
      this.usuarios.set(await this.srv.listar());
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }

  edad(u: Usuario) {
    return calcularEdad(u.fecha_nacimiento);
  }

  async cambiar(u: Usuario, rol: Rol) {
    if (u.rol === rol) return;
    try {
      await this.srv.cambiarRol(u, rol);
      this.usuarios.update((l) => l.map((x) => (x.id === u.id ? { ...x, rol } : x)));
      this.avisos.exito(`${u.email} ahora es ${rol}.`);
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }
}
