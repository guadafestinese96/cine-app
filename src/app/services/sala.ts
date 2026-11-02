import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';
import { ActividadService } from './actividad';
import { Sala, TipoButaca } from '../core/modelos';

export interface Asiento {
  id: string; // "J10"
  fila: string;
  numero: number;
  tipo: TipoButaca;
}

export interface FilaSala {
  letra: string;
  /** Tres bloques (izquierda, centro, derecha). null = lugar vacío (pasillo de silla de ruedas). */
  bloques: (Asiento | null)[][];
}

export const FILAS = 'ABCDEFGHIJKLMNOPQRST'.split('');
export const FILAS_ADAPTADAS = ['J', 'K'];
export const FILAS_VIP = ['R', 'S', 'T'];

/**
 * Todas las salas comparten la misma forma: 20 filas (A–T) y tres columnas de 4, 20 y 4 butacas.
 * En J y K quedan 2, 10 y 2 butacas adaptadas para personas con discapacidad.
 * R, S y T son VIP.
 */
@Injectable({ providedIn: 'root' })
export class SalaService {
  private sb = inject(SupabaseService).client;
  private actividad = inject(ActividadService);

  readonly plano: FilaSala[] = SalaService.generarPlano();

  static generarPlano(): FilaSala[] {
    return FILAS.map((letra) => {
      const adaptada = FILAS_ADAPTADAS.includes(letra);
      const tipo: TipoButaca = adaptada ? 'adaptada' : FILAS_VIP.includes(letra) ? 'vip' : 'estandar';
      const asiento = (n: number): Asiento => ({ id: `${letra}${n}`, fila: letra, numero: n, tipo });
      const rango = (desde: number, hasta: number, habilitado: (n: number) => boolean) =>
        Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i).map((n) => (habilitado(n) ? asiento(n) : null));

      return {
        letra,
        bloques: adaptada
          ? [
              rango(1, 4, (n) => n <= 2),
              rango(5, 24, (n) => n >= 10 && n <= 19),
              rango(25, 28, (n) => n >= 27),
            ]
          : [rango(1, 4, () => true), rango(5, 24, () => true), rango(25, 28, () => true)],
      };
    });
  }

  get capacidad(): number {
    return this.plano.reduce((total, f) => total + f.bloques.flat().filter(Boolean).length, 0);
  }

  async listar(incluirInactivas = true): Promise<Sala[]> {
    let consulta = this.sb.from('salas').select('*').order('id');
    if (!incluirInactivas) consulta = consulta.or('activa.eq.true,activa.is.null');
    const { data, error } = await consulta;
    if (error) throw error;
    return (data ?? []).map((s) => ({ ...s, butacas_bloqueadas: s.butacas_bloqueadas ?? [] }));
  }

  async obtener(id: number): Promise<Sala | null> {
    const { data } = await this.sb.from('salas').select('*').eq('id', id).maybeSingle();
    return data ? { ...data, butacas_bloqueadas: data.butacas_bloqueadas ?? [] } : null;
  }

  async guardar(sala: Partial<Sala>) {
    if (sala.id) {
      const { error } = await this.sb
        .from('salas')
        .update({ nombre: sala.nombre, activa: sala.activa, butacas_bloqueadas: sala.butacas_bloqueadas })
        .eq('id', sala.id);
      if (error) throw error;
      await this.actividad.registrar('Editó sala', `${sala.nombre}`);
    } else {
      const { error } = await this.sb.from('salas').insert([{ nombre: sala.nombre, activa: true, butacas_bloqueadas: [] }]);
      if (error) throw error;
      await this.actividad.registrar('Creó sala', `${sala.nombre}`);
    }
  }

  async guardarBloqueos(sala: Sala, bloqueadas: string[]) {
    const { error } = await this.sb.from('salas').update({ butacas_bloqueadas: bloqueadas }).eq('id', sala.id);
    if (error) throw error;
    await this.actividad.registrar(
      'Cambió distribución de butacas',
      `${sala.nombre}: ${bloqueadas.length ? bloqueadas.join(', ') + ' fuera de servicio' : 'todas habilitadas'}`,
    );
  }
}
