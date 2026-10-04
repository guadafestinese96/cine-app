import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase';

export interface ProductoCandy {
  id: number;
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

  // Obtener solo productos disponibles para el cliente
  async obtenerProductos(): Promise<ProductoCandy[]> {
    const { data, error } = await this.supabase.client
      .from('candy_bar')
      .select('*')
      .or('activo.eq.true,activo.is.null') // Muestra activos o no definidos aún
      .order('id', { ascending: true });

    if (error) {
      console.error('Error al obtener productos de Candy Bar:', error);
      return [];
    }

    return data || [];
  }
}