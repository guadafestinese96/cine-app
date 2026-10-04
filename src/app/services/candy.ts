import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase';

export interface ProductoCandy {
  id?: number;
  nombre: string;
  descripcion?: string;
  precio: number;
  categoria: string;
  imagen_url?: string;
  es_combo?: boolean;
  activo?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class CandyService {
  constructor(private supabase: SupabaseService) {}

  // Obtener productos visibles para los clientes
  async obtenerProductos(): Promise<ProductoCandy[]> {
    const { data, error } = await this.supabase.client
      .from('candy_bar')
      .select('*')
      .or('activo.eq.true,activo.is.null')
      .order('id', { ascending: true });

    if (error) {
      console.error('Error al obtener productos de Candy Bar:', error);
      return [];
    }

    return data || [];
  }

  // Obtener todos los productos para el panel de Administrador
  async obtenerTodosLosProductos(): Promise<ProductoCandy[]> {
    const { data, error } = await this.supabase.client
      .from('candy_bar')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Error al obtener productos de Candy Bar:', error);
      return [];
    }
    return data || [];
  }

  // Crear o editar un producto de Candy Bar
  async guardarProducto(producto: ProductoCandy) {
    const datosGuardar = {
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      precio: producto.precio,
      categoria: producto.categoria,
      imagen_url: producto.imagen_url || '',
      es_combo: producto.es_combo || false
    };

    if (producto.id) {
      const { data, error } = await this.supabase.client
        .from('candy_bar')
        .update(datosGuardar)
        .eq('id', producto.id)
        .select();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await this.supabase.client
        .from('candy_bar')
        .insert([{ ...datosGuardar, activo: true }])
        .select();

      if (error) throw error;
      return data;
    }
  }

  // Cambiar disponibilidad/visibilidad del producto
  async cambiarVisibilidad(id: number, activo: boolean) {
    const { data, error } = await this.supabase.client
      .from('candy_bar')
      .update({ activo })
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error al cambiar visibilidad de producto:', error);
      throw error;
    }
    return data;
  }
}