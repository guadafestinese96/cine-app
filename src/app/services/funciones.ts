import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';
import { ActividadService } from './actividad';
import { Funcion, Pelicula, Sala } from '../core/modelos';
import { aIsoLocal, formatearFuncion, inicioDelDia, parsearFechaLocal, sumarDias, sumarMinutos } from '../core/utilidades';

/** Minutos obligatorios de limpieza entre el fin de una función y el inicio de la siguiente. */
export const MINUTOS_LIMPIEZA = 30;

export interface PedidoProgramacion {
  pelicula: Pelicula;
  dias: number[]; // 0 = domingo … 6 = sábado
  horas: string[]; // "18:00"
  desde: Date;
  semanas: number;
  formato: string;
  idioma: string;
  precioBase: number | null;
  salaFija: number | null; // null = asignación automática
}

export interface FuncionPlanificada {
  inicio: Date;
  fin: Date;
  salaId: number | null;
  salaNombre: string;
  problema: string | null;
}

interface Ocupacion {
  salaId: number;
  inicio: number;
  fin: number;
}

@Injectable({ providedIn: 'root' })
export class FuncionesService {
  private sb = inject(SupabaseService).client;
  private actividad = inject(ActividadService);

  private readonly seleccion = '*, peliculas(*), salas(*)';

  async listar(filtro: { peliculaId?: number; soloFuturas?: boolean } = {}): Promise<Funcion[]> {
    let consulta = this.sb.from('funciones').select(this.seleccion).order('fecha_hora');
    if (filtro.peliculaId) consulta = consulta.eq('pelicula_id', filtro.peliculaId);
    const { data, error } = await consulta;
    if (error) throw error;
    let funciones = (data ?? []) as Funcion[];
    funciones = funciones.filter((f) => f.activa !== false);
    if (filtro.soloFuturas) {
      const ahora = Date.now();
      funciones = funciones.filter((f) => parsearFechaLocal(f.fecha_hora).getTime() > ahora);
    }
    return funciones;
  }

  async obtener(id: number): Promise<Funcion | null> {
    const { data, error } = await this.sb.from('funciones').select(this.seleccion).eq('id', id).maybeSingle();
    if (error) throw error;
    return data as Funcion | null;
  }

  /**
   * Arma el calendario pedido (ej. lunes, martes y viernes a las 18 h durante 2 semanas)
   * y asigna a cada función la primera sala libre, respetando duración + 30 min de limpieza.
   * No guarda nada: devuelve la vista previa para que el admin confirme.
   */
  planificar(pedido: PedidoProgramacion, existentes: Funcion[], salas: Sala[], duraciones: Map<number, number>): FuncionPlanificada[] {
    const ocupadas: Ocupacion[] = existentes.map((f) => {
      const inicio = parsearFechaLocal(f.fecha_hora).getTime();
      const duracion = Number(f.peliculas?.duracion_minutos ?? duraciones.get(Number(f.pelicula_id)) ?? 120);
      return { salaId: Number(f.sala_id), inicio, fin: inicio + duracion * 60_000 };
    });

    const candidatas = salas.filter((s) => s.activa !== false && (!pedido.salaFija || s.id === pedido.salaFija));
    const duracion = Number(pedido.pelicula.duracion_minutos);
    const estreno = pedido.pelicula.fecha_estreno ? parsearFechaLocal(pedido.pelicula.fecha_estreno) : null;
    const ahora = Date.now();
    const resultado: FuncionPlanificada[] = [];
    const desde = inicioDelDia(pedido.desde);

    for (let d = 0; d < pedido.semanas * 7; d++) {
      const dia = sumarDias(desde, d);
      if (!pedido.dias.includes(dia.getDay())) continue;

      for (const hora of [...pedido.horas].sort()) {
        const [hh, mm] = hora.split(':').map(Number);
        const inicio = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hh, mm);
        const fin = sumarMinutos(inicio, duracion);
        const item: FuncionPlanificada = { inicio, fin, salaId: null, salaNombre: '', problema: null };

        if (inicio.getTime() <= ahora) {
          item.problema = 'El horario ya pasó';
        } else if (estreno && inicio < estreno) {
          item.problema = 'Es anterior a la fecha de estreno';
        } else {
          const libre = candidatas.find((s) => !this.haySuperposicion(ocupadas, s.id, inicio.getTime(), fin.getTime()));
          if (libre) {
            item.salaId = libre.id;
            item.salaNombre = libre.nombre;
            ocupadas.push({ salaId: libre.id, inicio: inicio.getTime(), fin: fin.getTime() });
          } else {
            item.problema = pedido.salaFija ? 'La sala elegida está ocupada' : 'No hay salas libres en ese horario';
          }
        }
        resultado.push(item);
      }
    }
    return resultado;
  }

  /** Dos funciones chocan si alguna empieza antes de que la otra termine + 30 minutos. */
  private haySuperposicion(ocupadas: Ocupacion[], salaId: number, inicio: number, fin: number): boolean {
    const margen = MINUTOS_LIMPIEZA * 60_000;
    return ocupadas.some((o) => o.salaId === salaId && inicio < o.fin + margen && o.inicio < fin + margen);
  }

  async crear(pedido: PedidoProgramacion, plan: FuncionPlanificada[]): Promise<number> {
    const filas = plan
      .filter((p) => p.salaId && !p.problema)
      .map((p) => ({
        pelicula_id: pedido.pelicula.id,
        sala_id: p.salaId,
        fecha_hora: aIsoLocal(p.inicio),
        formato: pedido.formato,
        idioma: pedido.idioma,
        precio_base: pedido.precioBase,
      }));
    if (!filas.length) return 0;
    const { error } = await this.sb.from('funciones').insert(filas);
    if (error) throw error;

    const detalle = plan
      .filter((p) => p.salaId && !p.problema)
      .map((p) => `${formatearFuncion(p.inicio)} (${p.salaNombre})`)
      .join('; ');
    await this.actividad.registrar(
      filas.length === 1 ? 'Creó función' : `Creó ${filas.length} funciones`,
      `"${pedido.pelicula.nombre}" ${pedido.formato} ${pedido.idioma}: ${detalle}`,
    );
    return filas.length;
  }

  async cambiarPrecio(funcion: Funcion, precio: number | null) {
    const { error } = await this.sb.from('funciones').update({ precio_base: precio }).eq('id', funcion.id);
    if (error) throw error;
    await this.actividad.registrar(
      'Modificó precio de función',
      `"${funcion.peliculas?.nombre}" ${formatearFuncion(funcion.fecha_hora)}: ${funcion.precio_base ?? 'general'} → ${precio ?? 'general'}`,
    );
  }

  /** Solo se pueden borrar funciones sin entradas vendidas. */
  async eliminar(funcion: Funcion) {
    const { count } = await this.sb
      .from('compras')
      .select('id', { count: 'exact', head: true })
      .eq('funcion_id', funcion.id)
      .eq('estado', 'pagada');
    if (count) throw new Error('No se puede eliminar: la función ya tiene entradas vendidas.');
    const { error } = await this.sb.from('funciones').delete().eq('id', funcion.id);
    if (error) throw error;
    await this.actividad.registrar(
      'Eliminó función',
      `"${funcion.peliculas?.nombre}" ${formatearFuncion(funcion.fecha_hora)} (${funcion.salas?.nombre ?? 'Sala ' + funcion.sala_id})`,
    );
  }
}
