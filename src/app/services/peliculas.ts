import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';
import { ActividadService } from './actividad';
import { ConfiguracionService } from './configuracion';
import { Funcion, Pelicula, Resena } from '../core/modelos';
import { inicioDelDia, normalizarGeneros, parsearFechaLocal, sumarDias } from '../core/utilidades';

export type EstadoVenta = 'cartelera' | 'preventa' | 'proximamente' | 'oculta';

export interface Puntaje {
  promedio: number;
  cantidad: number;
}

export const DIAS_PREVENTA = 7;

@Injectable({ providedIn: 'root' })
export class PeliculasService {
  private sb = inject(SupabaseService).client;
  private actividad = inject(ActividadService);
  private config = inject(ConfiguracionService);

  // ---------------------------------------------------------------- Películas

  async listar(incluirOcultas = false): Promise<Pelicula[]> {
    let consulta = this.sb.from('peliculas').select('*').order('nombre');
    if (!incluirOcultas) consulta = consulta.or('activa.eq.true,activa.is.null');
    const { data, error } = await consulta;
    if (error) throw error;
    return (data ?? []).map((p) => this.normalizar(p));
  }

  async obtener(id: number): Promise<Pelicula | null> {
    const { data, error } = await this.sb.from('peliculas').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? this.normalizar(data) : null;
  }

  private normalizar(p: any): Pelicula {
    return {
      ...p,
      nombre: p.nombre ?? p.titulo ?? 'Sin título',
      duracion_minutos: Number(p.duracion_minutos ?? p.duracion ?? 120),
      genero: normalizarGeneros(p.genero),
      clasificacion: p.clasificacion ?? p.restriccion_edad ?? 'ATP',
      precio_preventa: p.precio_preventa != null ? Number(p.precio_preventa) : null,
    };
  }

  async guardar(pelicula: Partial<Pelicula>): Promise<Pelicula> {
    const datos = {
      nombre: pelicula.nombre,
      sinopsis: pelicula.sinopsis,
      duracion_minutos: Number(pelicula.duracion_minutos),
      genero: pelicula.genero,
      clasificacion: pelicula.clasificacion,
      imagen_url: pelicula.imagen_url,
      fecha_estreno: pelicula.fecha_estreno || null,
      preventa_activa: !!pelicula.preventa_activa,
      precio_preventa: pelicula.precio_preventa ? Number(pelicula.precio_preventa) : null,
    };

    if (pelicula.id) {
      const anterior = await this.obtener(pelicula.id);
      const { data, error } = await this.sb.from('peliculas').update(datos).eq('id', pelicula.id).select().single();
      if (error) throw error;
      let detalle = `"${datos.nombre}"`;
      if (anterior && (anterior.precio_preventa ?? null) !== (datos.precio_preventa ?? null)) {
        await this.actividad.registrar(
          'Modificó precio de preventa',
          `${detalle}: ${anterior.precio_preventa ?? '—'} → ${datos.precio_preventa ?? '—'}`,
        );
      }
      await this.actividad.registrar('Editó película', detalle);
      return this.normalizar(data);
    }

    const { data, error } = await this.sb.from('peliculas').insert([{ ...datos, activa: true }]).select().single();
    if (error) throw error;
    await this.actividad.registrar('Creó película', `"${datos.nombre}"`);
    return this.normalizar(data);
  }

  async cambiarVisibilidad(pelicula: Pelicula, activa: boolean) {
    const { error } = await this.sb.from('peliculas').update({ activa }).eq('id', pelicula.id);
    if (error) throw error;
    await this.actividad.registrar(activa ? 'Mostró película' : 'Ocultó película', `"${pelicula.nombre}"`);
  }

  // ----------------------------------------------------- Reglas de venta

  /**
   * - Sin fecha de estreno o ya estrenada → cartelera.
   * - Estreno futuro con preventa activa y dentro de los 7 días previos → preventa.
   * - Estreno futuro fuera de esa ventana → próximamente (solo se puede pedir aviso).
   */
  estadoVenta(p: Pelicula, ahora = new Date()): EstadoVenta {
    if (p.activa === false) return 'oculta';
    if (!p.fecha_estreno) return 'cartelera';
    const estreno = parsearFechaLocal(p.fecha_estreno);
    const hoy = inicioDelDia(ahora);
    if (estreno <= hoy) return 'cartelera';
    if (p.preventa_activa && hoy >= sumarDias(estreno, -DIAS_PREVENTA)) return 'preventa';
    return 'proximamente';
  }

  estaEnVenta(p: Pelicula): boolean {
    const estado = this.estadoVenta(p);
    return estado === 'cartelera' || estado === 'preventa';
  }

  /** Precio de una entrada estándar para esa función, contemplando la preventa. */
  precioEntrada(p: Pelicula | undefined, f: Funcion | null): number {
    if (p && this.estadoVenta(p) === 'preventa' && p.precio_preventa) return Number(p.precio_preventa);
    if (f?.precio_base) return Number(f.precio_base);
    return this.config.valores().precio_entrada;
  }

  fechaAperturaPreventa(p: Pelicula): Date | null {
    if (!p.fecha_estreno) return null;
    return sumarDias(parsearFechaLocal(p.fecha_estreno), -DIAS_PREVENTA);
  }

  /** Entradas vendidas por película (compras pagadas). */
  async entradasVendidasPorPelicula(): Promise<Map<number, number>> {
    const { data, error } = await this.sb
      .from('compras')
      .select('pelicula_id, cantidad_entradas')
      .eq('estado', 'pagada');
    const mapa = new Map<number, number>();
    if (error) {
      console.warn('No se pudieron leer las ventas', error);
      return mapa;
    }
    for (const c of data ?? []) {
      const id = Number(c.pelicula_id);
      mapa.set(id, (mapa.get(id) ?? 0) + Number(c.cantidad_entradas || 0));
    }
    return mapa;
  }

  // -------------------------------------------------------------- Reseñas

  async puntajes(): Promise<Map<number, Puntaje>> {
    const { data, error } = await this.sb.from('resenas').select('pelicula_id, estrellas');
    const acumulado = new Map<number, { suma: number; cantidad: number }>();
    if (error) {
      console.warn('No se pudieron leer las reseñas', error);
      return new Map();
    }
    for (const r of data ?? []) {
      const id = Number(r.pelicula_id);
      const a = acumulado.get(id) ?? { suma: 0, cantidad: 0 };
      a.suma += Number(r.estrellas);
      a.cantidad++;
      acumulado.set(id, a);
    }
    const resultado = new Map<number, Puntaje>();
    acumulado.forEach((a, id) => resultado.set(id, { promedio: a.suma / a.cantidad, cantidad: a.cantidad }));
    return resultado;
  }

  async resenas(peliculaId: number): Promise<Resena[]> {
    const { data, error } = await this.sb
      .from('resenas')
      .select('*')
      .eq('pelicula_id', peliculaId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async resenasDeUsuario(usuarioId: string): Promise<Resena[]> {
    const { data, error } = await this.sb.from('resenas').select('*').eq('usuario_id', usuarioId);
    if (error) throw error;
    return data ?? [];
  }

  /** Una reseña por persona y película: si ya existe se actualiza. */
  async guardarResena(resena: Resena) {
    const { error } = await this.sb.from('resenas').upsert(
      [{ ...resena, comentario: (resena.comentario ?? '').slice(0, 280), created_at: new Date().toISOString() }],
      { onConflict: 'pelicula_id,usuario_id' },
    );
    if (error) throw error;
  }

  // ------------------------------------------------------ Alertas de estreno

  async activarAlerta(peliculaId: number, email: string) {
    const { error } = await this.sb
      .from('alertas_estreno')
      .upsert([{ pelicula_id: peliculaId, email_usuario: email, notificado: false }], {
        onConflict: 'pelicula_id,email_usuario',
      });
    if (error) throw error;
  }

  async alertasDeUsuario(email: string): Promise<number[]> {
    const { data } = await this.sb.from('alertas_estreno').select('pelicula_id').eq('email_usuario', email);
    return (data ?? []).map((a) => Number(a.pelicula_id));
  }

  /**
   * Devuelve las películas con alerta pendiente que ya tienen entradas a la venta
   * y las marca como notificadas para no avisar dos veces.
   */
  async alertasListas(email: string): Promise<Pelicula[]> {
    const { data, error } = await this.sb
      .from('alertas_estreno')
      .select('pelicula_id, peliculas(*)')
      .eq('email_usuario', email)
      .eq('notificado', false);
    if (error || !data?.length) return [];

    const listas: Pelicula[] = [];
    for (const alerta of data as any[]) {
      if (!alerta.peliculas) continue;
      const p = this.normalizar(alerta.peliculas);
      if (!this.estaEnVenta(p)) continue;
      const { count } = await this.sb
        .from('funciones')
        .select('id', { count: 'exact', head: true })
        .eq('pelicula_id', p.id);
      if (count) listas.push(p);
    }
    if (listas.length) {
      await this.sb
        .from('alertas_estreno')
        .update({ notificado: true })
        .eq('email_usuario', email)
        .in('pelicula_id', listas.map((p) => p.id));
    }
    return listas;
  }
}
