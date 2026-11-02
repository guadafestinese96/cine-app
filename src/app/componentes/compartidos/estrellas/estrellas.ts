import { Component, computed, input, output, signal } from '@angular/core';

/** Estrellas de 1 a 5. Con `editable` se pueden elegir con mouse, toque o teclado. */
@Component({
  selector: 'app-estrellas',
  template: `
    @if (editable()) {
      <div class="estrellas editable" role="radiogroup" [attr.aria-label]="etiqueta()">
        @for (n of [1, 2, 3, 4, 5]; track n) {
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="valor() === n"
            [attr.aria-label]="n + (n === 1 ? ' estrella' : ' estrellas')"
            [class.llena]="n <= (hover() || valor())"
            (mouseenter)="hover.set(n)"
            (mouseleave)="hover.set(0)"
            (click)="cambio.emit(n)"
          >★</button>
        }
      </div>
    } @else {
      <span class="estrellas" [attr.aria-label]="'Puntaje ' + valorTexto() + ' de 5'" [style.--relleno]="relleno()">
        <span class="fondo" aria-hidden="true">★★★★★</span>
        <span class="frente" aria-hidden="true">★★★★★</span>
      </span>
    }
  `,
  styles: `
    :host { display: inline-flex; }
    .estrellas { position: relative; display: inline-block; font-size: var(--tam, 1rem); line-height: 1; letter-spacing: 2px; }
    .fondo { color: rgba(240, 206, 126, 0.25); }
    .frente { position: absolute; inset: 0; overflow: hidden; width: var(--relleno); color: var(--bronce-claro); white-space: nowrap; }
    .editable { display: inline-flex; gap: 2px; }
    .editable button {
      border: 0; background: none; padding: 2px; cursor: pointer;
      font-size: var(--tam, 1.6rem); line-height: 1; color: rgba(240, 206, 126, 0.25);
    }
    .editable button.llena { color: var(--bronce-claro); }
  `,
})
export class EstrellasComponent {
  valor = input(0);
  editable = input(false);
  etiqueta = input('Calificación');
  cambio = output<number>();

  hover = signal(0);
  relleno = computed(() => `${Math.max(0, Math.min(5, this.valor())) * 20}%`);
  valorTexto = computed(() => this.valor().toFixed(1).replace('.', ','));
}
