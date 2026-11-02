import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase';
import { ActividadService } from './actividad';

export interface Configuracion {
  precio_entrada: number;
  recargo_vip_pct: number;
  minutos_reserva: number;
}

const POR_DEFECTO: Configuracion = { precio_entrada: 5000, recargo_vip_pct: 30, minutos_reserva: 10 };

/** Parámetros del negocio editables desde el panel de admin (tabla `configuracion`). */
@Injectable({ providedIn: 'root' })
export class ConfiguracionService {
  private sb = inject(SupabaseService).client;
  private actividad = inject(ActividadService);

  readonly valores = signal<Configuracion>(POR_DEFECTO);
  private carga: Promise<Configuracion> | null = null;

  cargar(forzar = false): Promise<Configuracion> {
    if (!this.carga || forzar) {
      this.carga = (async () => {
        const { data, error } = await this.sb.from('configuracion').select('clave, valor');
        const valores = { ...POR_DEFECTO };
        if (!error && data) {
          for (const fila of data) {
            if (fila.clave in valores) (valores as any)[fila.clave] = Number(fila.valor);
          }
        }
        this.valores.set(valores);
        return valores;
      })();
    }
    return this.carga;
  }

  async guardar(cambios: Partial<Configuracion>) {
    const anteriores = this.valores();
    const filas = Object.entries(cambios).map(([clave, valor]) => ({
      clave,
      valor: Number(valor),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await this.sb.from('configuracion').upsert(filas);
    if (error) throw error;
    this.valores.set({ ...anteriores, ...cambios });

    const detalle = Object.entries(cambios)
      .filter(([k, v]) => (anteriores as any)[k] !== Number(v))
      .map(([k, v]) => `${k}: ${(anteriores as any)[k]} → ${v}`)
      .join(', ');
    if (detalle) await this.actividad.registrar('Modificó precios', detalle);
  }

  precioVip(precioBase: number): number {
    return Math.round(precioBase * (1 + this.valores().recargo_vip_pct / 100));
  }
}
