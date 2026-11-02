import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';
import { ActividadService } from './actividad';
import { Combo, ProductoCandy } from '../core/modelos';

export type { ProductoCandy } from '../core/modelos';

/** Productos del candy bar (por categoría) y combos con entrada a precio fijo. */
@Injectable({ providedIn: 'root' })
export class CandyService {
  private sb = inject(SupabaseService).client;
  private actividad = inject(ActividadService);

  async obtenerProductos(incluirOcultos = false): Promise<ProductoCandy[]> {
    let consulta = this.sb.from('candy_bar').select('*').order('categoria').order('nombre');
    if (!incluirOcultos) consulta = consulta.or('activo.eq.true,activo.is.null');
    const { data, error } = await consulta;
    if (error) throw error;
    return (data ?? []).map((p) => ({ ...p, precio: Number(p.precio) }));
  }

  async guardarProducto(producto: ProductoCandy) {
    const datos = {
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      precio: Number(producto.precio),
      categoria: producto.categoria,
      imagen_url: producto.imagen_url || '',
      es_combo: !!producto.es_combo,
    };

    if (producto.id) {
      const { data: anterior } = await this.sb.from('candy_bar').select('precio').eq('id', producto.id).maybeSingle();
      const { error } = await this.sb.from('candy_bar').update(datos).eq('id', producto.id);
      if (error) throw error;
      if (anterior && Number(anterior.precio) !== datos.precio) {
        await this.actividad.registrar('Modificó precio de producto', `${datos.nombre}: $${anterior.precio} → $${datos.precio}`);
      } else {
        await this.actividad.registrar('Editó producto', datos.nombre);
      }
    } else {
      const { error } = await this.sb.from('candy_bar').insert([{ ...datos, activo: true }]);
      if (error) throw error;
      await this.actividad.registrar('Creó producto', `${datos.nombre} ($${datos.precio})`);
    }
  }

  async cambiarVisibilidad(producto: ProductoCandy, activo: boolean) {
    const { error } = await this.sb.from('candy_bar').update({ activo }).eq('id', producto.id);
    if (error) throw error;
    await this.actividad.registrar(activo ? 'Habilitó producto' : 'Ocultó producto', producto.nombre);
  }

  // ----------------------------------------------------------------- Combos

  async obtenerCombos(incluirOcultos = false): Promise<Combo[]> {
    let consulta = this.sb.from('combos').select('*').order('precio');
    if (!incluirOcultos) consulta = consulta.eq('activo', true);
    const { data, error } = await consulta;
    if (error) {
      console.warn('No se pudieron leer los combos', error);
      return [];
    }
    return (data ?? []).map((c) => ({ ...c, precio: Number(c.precio) }));
  }

  async guardarCombo(combo: Combo) {
    const datos = {
      nombre: combo.nombre,
      descripcion: combo.descripcion || '',
      incluye: combo.incluye || '',
      precio: Number(combo.precio),
      imagen_url: combo.imagen_url || '',
    };
    if (combo.id) {
      const { data: anterior } = await this.sb.from('combos').select('precio').eq('id', combo.id).maybeSingle();
      const { error } = await this.sb.from('combos').update(datos).eq('id', combo.id);
      if (error) throw error;
      if (anterior && Number(anterior.precio) !== datos.precio) {
        await this.actividad.registrar('Modificó precio de combo', `${datos.nombre}: $${anterior.precio} → $${datos.precio}`);
      } else {
        await this.actividad.registrar('Editó combo', datos.nombre);
      }
    } else {
      const { error } = await this.sb.from('combos').insert([{ ...datos, activo: true }]);
      if (error) throw error;
      await this.actividad.registrar('Creó combo', `${datos.nombre} ($${datos.precio})`);
    }
  }

  async cambiarVisibilidadCombo(combo: Combo, activo: boolean) {
    const { error } = await this.sb.from('combos').update({ activo }).eq('id', combo.id);
    if (error) throw error;
    await this.actividad.registrar(activo ? 'Habilitó combo' : 'Ocultó combo', combo.nombre);
  }
}
