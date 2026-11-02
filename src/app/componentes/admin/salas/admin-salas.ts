import { Component, computed, inject, signal } from '@angular/core';
import { Asiento, SalaService } from '../../../services/sala';
import { AvisosService } from '../../../services/avisos';
import { MapaButacasComponent } from '../../compartidos/mapa-butacas/mapa-butacas';
import { Sala } from '../../../core/modelos';
import { errorLegible } from '../../../core/utilidades';

/** Salas y distribución de butacas: se pueden marcar butacas fuera de servicio por sala. */
@Component({
  selector: 'app-admin-salas',
  imports: [MapaButacasComponent],
  template: `
    <div class="admin-dos">
      <section class="panel">
        <h2 class="admin-titulo">Salas</h2>
        @for (s of salas(); track s.id) {
          <div class="admin-fila" [class.apagada]="s.activa === false">
            <div class="crece">
              <strong>{{ s.nombre }}</strong>
              <span>{{ salaSrv.capacidad - (s.butacas_bloqueadas?.length ?? 0) }} butacas habilitadas</span>
            </div>
            <button type="button" class="interruptor" [attr.aria-pressed]="s.activa !== false" (click)="alternar(s)">
              {{ s.activa !== false ? 'Activa' : 'Inactiva' }}
            </button>
            <button type="button" class="boton fantasma chico" [class.activa]="elegida()?.id === s.id" (click)="elegir(s)">Butacas</button>
          </div>
        }
        <form class="nueva" (submit)="$event.preventDefault(); crear()">
          <input class="entrada" placeholder="Nombre de la nueva sala" aria-label="Nombre de la nueva sala" [value]="nombreNueva()" (input)="nombreNueva.set($any($event.target).value)" />
          <button class="boton secundario" type="submit" [disabled]="!nombreNueva().trim()">Agregar sala</button>
        </form>
        <p class="texto-suave nota">
          Todas las salas tienen 20 filas (A–T) con columnas de 4, 20 y 4 butacas. J y K son accesibles (2, 10 y 2) y R, S y T son VIP.
          Las salas inactivas no se usan en la asignación automática.
        </p>
      </section>

      <section>
        @if (elegida(); as s) {
          <div class="cabecera-mapa">
            <h2 class="admin-titulo">Distribución de {{ s.nombre }}</h2>
            <button type="button" class="boton" [disabled]="!cambios()" (click)="guardarBloqueos()">Guardar distribución</button>
          </div>
          <p class="texto-suave nota">Tocá una butaca para marcarla fuera de servicio (rota, en reparación). No se podrá vender.</p>
          <div class="panel">
            <app-mapa-butacas [plano]="salaSrv.plano" [mias]="bloqueadas()" modo="admin" (tocar)="alternarButaca($event)" />
          </div>
        } @else {
          <div class="vacio">Elegí una sala para ver y editar sus butacas.</div>
        }
      </section>
    </div>
  `,
  styles: `
    .nueva { display: flex; gap: 10px; margin-top: 18px; }
    .nota { font-size: 0.85rem; margin: 14px 0; }
    .cabecera-mapa { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .boton.fantasma.activa { color: var(--bronce-claro); }
  `,
})
export class AdminSalasComponent {
  salaSrv = inject(SalaService);
  private avisos = inject(AvisosService);

  salas = signal<Sala[]>([]);
  elegida = signal<Sala | null>(null);
  bloqueadas = signal<Set<string>>(new Set());
  nombreNueva = signal('');

  cambios = computed(() => {
    const original = new Set(this.elegida()?.butacas_bloqueadas ?? []);
    const actual = this.bloqueadas();
    return original.size !== actual.size || [...actual].some((b) => !original.has(b));
  });

  constructor() {
    this.cargar();
  }

  async cargar() {
    try {
      this.salas.set(await this.salaSrv.listar());
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }

  elegir(s: Sala) {
    this.elegida.set(s);
    this.bloqueadas.set(new Set(s.butacas_bloqueadas ?? []));
  }

  alternarButaca(a: Asiento) {
    const nuevo = new Set(this.bloqueadas());
    nuevo.has(a.id) ? nuevo.delete(a.id) : nuevo.add(a.id);
    this.bloqueadas.set(nuevo);
  }

  async guardarBloqueos() {
    const s = this.elegida();
    if (!s) return;
    try {
      const lista = [...this.bloqueadas()].sort();
      await this.salaSrv.guardarBloqueos(s, lista);
      const actualizada = { ...s, butacas_bloqueadas: lista };
      this.salas.update((l) => l.map((x) => (x.id === s.id ? actualizada : x)));
      this.elegida.set(actualizada);
      this.avisos.exito('Distribución guardada.');
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }

  async alternar(s: Sala) {
    try {
      await this.salaSrv.guardar({ ...s, activa: s.activa === false });
      await this.cargar();
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }

  async crear() {
    try {
      await this.salaSrv.guardar({ nombre: this.nombreNueva().trim() });
      this.nombreNueva.set('');
      await this.cargar();
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }
}
