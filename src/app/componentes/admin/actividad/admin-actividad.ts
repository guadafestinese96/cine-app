import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActividadService } from '../../../services/actividad';
import { AvisosService } from '../../../services/avisos';
import { LogActividad } from '../../../core/modelos';
import { errorLegible } from '../../../core/utilidades';

/** Log de actividad: quién creó funciones, cambió precios, validó QRs, etc. */
@Component({
  selector: 'app-admin-actividad',
  imports: [DatePipe],
  template: `
    <div class="filtros">
      <input class="entrada" type="search" placeholder="Buscar por usuario, acción o detalle" aria-label="Buscar en la actividad"
        [value]="busqueda()" (input)="busqueda.set($any($event.target).value)" />
      <div class="fichas">
        @for (t of tipos; track t.id) {
          <button type="button" class="ficha" [class.activa]="tipo() === t.id" (click)="tipo.set(t.id)">{{ t.nombre }}</button>
        }
      </div>
      <button type="button" class="boton secundario chico" (click)="cargar()">Actualizar</button>
    </div>
    <div class="tabla-envoltura">
      <table class="tabla">
        <thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead>
        <tbody>
          @for (l of filtrados(); track l.id) {
            <tr>
              <td class="numero fecha">{{ l.created_at | date: 'dd/MM/yyyy HH:mm:ss' }}</td>
              <td>{{ l.usuario_email }}</td>
              <td><strong>{{ l.accion }}</strong></td>
              <td class="detalle">{{ l.detalle }}</td>
            </tr>
          } @empty {
            <tr><td colspan="4" class="texto-suave">Sin actividad registrada.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .filtros { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 18px; }
    .filtros .entrada { max-width: 340px; }
    .fecha { white-space: nowrap; }
    .detalle { color: var(--texto-suave); font-size: 0.88rem; }
  `,
})
export class AdminActividadComponent {
  private srv = inject(ActividadService);
  private avisos = inject(AvisosService);

  readonly tipos = [
    { id: 'todo', nombre: 'Todo' },
    { id: 'funcion', nombre: 'Funciones' },
    { id: 'precio', nombre: 'Precios' },
    { id: 'qr', nombre: 'Validaciones' },
  ];

  logs = signal<LogActividad[]>([]);
  busqueda = signal('');
  tipo = signal('todo');

  filtrados = computed(() => {
    const t = this.busqueda().toLowerCase().trim();
    const tipo = this.tipo();
    return this.logs().filter((l) => {
      const accion = l.accion.toLowerCase();
      const coincideTipo =
        tipo === 'todo' ||
        (tipo === 'funcion' && accion.includes('funci')) ||
        (tipo === 'precio' && accion.includes('precio')) ||
        (tipo === 'qr' && accion.includes('valid'));
      return coincideTipo && (!t || `${l.usuario_email} ${l.accion} ${l.detalle}`.toLowerCase().includes(t));
    });
  });

  constructor() {
    this.cargar();
  }

  async cargar() {
    try {
      this.logs.set(await this.srv.listar(300));
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }
}
