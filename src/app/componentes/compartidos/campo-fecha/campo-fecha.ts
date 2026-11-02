import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { aFechaIso, dos } from '../../../core/utilidades';

export interface AtajoFecha {
  etiqueta: string;
  fecha: Date;
}

/**
 * Fecha tipeada en tres casillas (día / mes / año) que saltan solas a la siguiente,
 * más atajos de un toque. Reemplaza al calendario desplegable que obliga a navegar mes por mes.
 * Valor del control: "YYYY-MM-DD" o "" si está incompleta o es inválida.
 */
@Component({
  selector: 'app-campo-fecha',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CampoFechaComponent), multi: true }],
  template: `
    <div class="fecha" role="group" [attr.aria-label]="etiqueta()">
      <input #d class="entrada" inputmode="numeric" maxlength="2" placeholder="DD" aria-label="Día"
        [value]="dia()" [disabled]="deshabilitado()" (input)="escribir('dia', d, m)" (blur)="tocado()" />
      <span aria-hidden="true">/</span>
      <input #m class="entrada" inputmode="numeric" maxlength="2" placeholder="MM" aria-label="Mes"
        [value]="mes()" [disabled]="deshabilitado()" (input)="escribir('mes', m, a)" (blur)="tocado()"
        (keydown.backspace)="retroceder(m, d)" />
      <span aria-hidden="true">/</span>
      <input #a class="entrada anio" inputmode="numeric" maxlength="4" placeholder="AAAA" aria-label="Año"
        [value]="anio()" [disabled]="deshabilitado()" (input)="escribir('anio', a, null)" (blur)="tocado()"
        (keydown.backspace)="retroceder(a, m)" />
    </div>
    @if (atajos().length) {
      <div class="fichas atajos">
        @for (x of atajos(); track x.etiqueta) {
          <button type="button" class="ficha" [class.activa]="esActual(x.fecha)" (click)="elegir(x.fecha)">{{ x.etiqueta }}</button>
        }
      </div>
    }
    @if (invalida()) {
      <span class="error-campo">Esa fecha no existe.</span>
    }
  `,
  styles: `
    .fecha { display: flex; align-items: center; gap: 6px; }
    .fecha .entrada { width: 64px; text-align: center; font-variant-numeric: tabular-nums; }
    .fecha .entrada.anio { width: 86px; }
    .fecha span { color: var(--texto-suave); }
    .atajos { margin-top: 10px; }
    .error-campo { display: block; margin-top: 6px; font-size: 0.8rem; color: var(--error); }
  `,
})
export class CampoFechaComponent implements ControlValueAccessor {
  atajos = input<AtajoFecha[]>([]);
  etiqueta = input('Fecha');

  dia = signal('');
  mes = signal('');
  anio = signal('');
  invalida = signal(false);
  deshabilitado = signal(false);

  private alCambiar: (v: string) => void = () => {};
  private alTocar: () => void = () => {};

  writeValue(valor: string | null): void {
    const m = String(valor ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    this.anio.set(m ? m[1] : '');
    this.mes.set(m ? m[2] : '');
    this.dia.set(m ? m[3] : '');
    this.invalida.set(false);
  }
  registerOnChange(fn: (v: string) => void): void {
    this.alCambiar = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }
  setDisabledState(d: boolean): void {
    this.deshabilitado.set(d);
  }

  escribir(campo: 'dia' | 'mes' | 'anio', el: HTMLInputElement, siguiente: HTMLInputElement | null) {
    const limpio = el.value.replace(/\D/g, '').slice(0, campo === 'anio' ? 4 : 2);
    el.value = limpio;
    this[campo].set(limpio);
    if (siguiente && limpio.length === 2) siguiente.focus();
    this.emitir();
  }

  retroceder(el: HTMLInputElement, anterior: HTMLInputElement) {
    if (!el.value) anterior.focus();
  }

  elegir(fecha: Date) {
    this.anio.set(String(fecha.getFullYear()));
    this.mes.set(dos(fecha.getMonth() + 1));
    this.dia.set(dos(fecha.getDate()));
    this.emitir();
    this.alTocar();
  }

  esActual(fecha: Date): boolean {
    return this.valorIso() === aFechaIso(fecha);
  }

  tocado() {
    this.alTocar();
  }

  private valorIso(): string {
    const d = Number(this.dia());
    const m = Number(this.mes());
    const a = Number(this.anio());
    if (!d || !m || this.anio().length !== 4) return '';
    const fecha = new Date(a, m - 1, d);
    if (fecha.getFullYear() !== a || fecha.getMonth() !== m - 1 || fecha.getDate() !== d) return 'invalida';
    return aFechaIso(fecha);
  }

  private emitir() {
    const iso = this.valorIso();
    this.invalida.set(iso === 'invalida');
    this.alCambiar(iso === 'invalida' ? '' : iso);
  }
}
