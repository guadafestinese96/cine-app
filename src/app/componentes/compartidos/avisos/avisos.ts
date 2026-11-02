import { Component, inject } from '@angular/core';
import { AvisosService } from '../../../services/avisos';

@Component({
  selector: 'app-avisos',
  template: `
    <div class="pila" aria-live="polite">
      @for (a of avisos.avisos(); track a.id) {
        <div class="aviso" [class]="'aviso ' + a.tipo" role="status">
          <span>{{ a.texto }}</span>
          <button type="button" (click)="avisos.cerrar(a.id)" aria-label="Cerrar aviso">×</button>
        </div>
      }
    </div>
  `,
  styles: `
    .pila {
      position: fixed; right: 16px; bottom: 16px; z-index: 200;
      display: flex; flex-direction: column; gap: 10px; max-width: min(420px, calc(100vw - 32px));
    }
    .aviso {
      display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px;
      border-radius: 10px; background: var(--marfil); color: var(--tinta);
      box-shadow: var(--sombra); font-weight: 600; font-size: 0.92rem;
      border-left: 6px solid var(--bronce);
      animation: entrar 0.25s ease-out;
    }
    .aviso.exito { border-left-color: #3f8f4c; }
    .aviso.error { border-left-color: #c0392b; }
    .aviso span { flex: 1; }
    .aviso button { border: 0; background: none; font-size: 1.3rem; line-height: 1; cursor: pointer; color: inherit; }
    @keyframes entrar { from { transform: translateY(12px); opacity: 0; } }
  `,
})
export class AvisosComponent {
  avisos = inject(AvisosService);
}
