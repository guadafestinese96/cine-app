import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfiguracionService, Configuracion } from '../../../services/configuracion';
import { CuponesService } from '../../../services/cupones';
import { FidelidadService } from '../../../services/fidelidad';
import { AvisosService } from '../../../services/avisos';
import { Cupon, Recompensa } from '../../../core/modelos';
import { errorLegible } from '../../../core/utilidades';

const CUPON_VACIO: Cupon = { codigo: '', descripcion: '', porcentaje: 10, tipo: 'general', activo: true };
const RECOMPENSA_VACIA: Recompensa = { nombre: '', tipo: 'producto', puntos: 100, activa: true };

/** Precios generales, cupones (bienvenida configurable, mayores de 50) y recompensas de puntos. */
@Component({
  selector: 'app-admin-beneficios',
  imports: [FormsModule],
  templateUrl: './admin-beneficios.html',
  styles: `
    .grilla { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; align-items: start; }
    .panel h2 { margin-bottom: 6px; }
    .panel > p.texto-suave { font-size: 0.85rem; margin-bottom: 16px; }
    .editor { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--linea); }
    .tipo { font-size: 0.75rem; font-weight: 800; color: var(--bronce-claro); }
  `,
})
export class AdminBeneficiosComponent {
  private config = inject(ConfiguracionService);
  private cuponesSrv = inject(CuponesService);
  private fidelidad = inject(FidelidadService);
  private avisos = inject(AvisosService);

  valores: Configuracion = { ...this.config.valores() };
  cupones = signal<Cupon[]>([]);
  recompensas = signal<Recompensa[]>([]);
  cupon: Cupon = { ...CUPON_VACIO };
  recompensa: Recompensa = { ...RECOMPENSA_VACIA };

  readonly tiposCupon: { valor: Cupon['tipo']; nombre: string }[] = [
    { valor: 'general', nombre: 'Cualquier usuario registrado' },
    { valor: 'mayores_50', nombre: 'Solo mayores de 50 años' },
    { valor: 'bienvenida', nombre: 'Primera compra (automático)' },
  ];

  constructor() {
    this.cargar();
  }

  async cargar() {
    try {
      this.valores = { ...(await this.config.cargar(true)) };
      const [cupones, recompensas] = await Promise.all([this.cuponesSrv.listar(), this.fidelidad.recompensas(true)]);
      this.cupones.set(cupones);
      this.recompensas.set(recompensas);
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }

  nombreTipo(t: Cupon['tipo']) {
    return this.tiposCupon.find((x) => x.valor === t)?.nombre ?? t;
  }

  async guardarConfig() {
    try {
      await this.config.guardar(this.valores);
      this.avisos.exito('Precios guardados.');
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }

  limpiarCupon() {
    this.cupon = { ...CUPON_VACIO };
  }

  limpiarRecompensa() {
    this.recompensa = { ...RECOMPENSA_VACIA };
  }

  editarCupon(c: Cupon) {
    this.cupon = { ...c };
  }

  async guardarCupon() {
    if (!this.cupon.codigo.trim() || !(this.cupon.porcentaje > 0 && this.cupon.porcentaje <= 100)) {
      this.avisos.error('El cupón necesita un código y un porcentaje entre 1 y 100.');
      return;
    }
    try {
      await this.cuponesSrv.guardar(this.cupon);
      this.avisos.exito('Cupón guardado.');
      this.cupon = { ...CUPON_VACIO };
      this.cupones.set(await this.cuponesSrv.listar());
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }

  async alternarCupon(c: Cupon) {
    try {
      await this.cuponesSrv.guardar({ ...c, activo: !c.activo });
      this.cupones.set(await this.cuponesSrv.listar());
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }

  editarRecompensa(r: Recompensa) {
    this.recompensa = { ...r };
  }

  async guardarRecompensa() {
    if (!this.recompensa.nombre.trim() || this.recompensa.puntos <= 0) {
      this.avisos.error('La recompensa necesita un nombre y un costo en puntos.');
      return;
    }
    try {
      await this.fidelidad.guardarRecompensa(this.recompensa);
      this.avisos.exito('Recompensa guardada.');
      this.recompensa = { ...RECOMPENSA_VACIA };
      this.recompensas.set(await this.fidelidad.recompensas(true));
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }

  async alternarRecompensa(r: Recompensa) {
    try {
      await this.fidelidad.guardarRecompensa({ ...r, activa: !r.activa });
      this.recompensas.set(await this.fidelidad.recompensas(true));
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }
}
