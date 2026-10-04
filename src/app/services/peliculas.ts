import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase';

@Injectable({
  providedIn: 'root',
})
export class PeliculasService {
  constructor(private supabase: SupabaseService) {}

  async obtenerPeliculas() {
    const { data, error } = await this.supabase.client.from('peliculas').select('*');

    if (error) {
      console.error('Error al obtener películas:', error);
      return [];
    }

    return data;
  }

  async guardarPelicula(pelicula: {
    nombre: string;
    sinopsis: string;
    duracion_minutos: number;
    genero: string[] | string;
    clasificacion: string;
    imagen_url: string;
    fecha_estreno?: string | null;
  }) {
    const { data, error } = await this.supabase.client.from('peliculas').insert([pelicula]).select();

    if (error) throw error;
    return data;
  }

  async agregarPelicula(pelicula: any) {
    return this.guardarPelicula(pelicula);
  }

  async obtenerSalas() {
    const { data, error } = await this.supabase.client.from('salas').select('*');
    if (error) throw error;
    return data;
  }

  async obtenerFuncionesPorSala(salaId: number) {
    const { data, error } = await this.supabase.client
      .from('funciones')
      .select('*, peliculas(duracion_minutos)')
      .eq('sala_id', salaId);
    if (error) throw error;
    return data || [];
  }

  async guardarFuncion(funcion: {
    pelicula_id: number;
    sala_id: number;
    fecha_hora: string;
    formato: string;
    idioma: string;
    precio_base?: number;
  }) {
    const { data, error } = await this.supabase.client.from('funciones').insert([funcion]).select();
    if (error) throw error;
    return data;
  }

  async agregarFuncion(funcion: any) {
    return this.guardarFuncion(funcion);
  }

  async obtenerButacasOcupadas(funcionId: number) {
    const { data, error } = await this.supabase.client
      .from('butacas_ocupadas')
      .select('fila, numero')
      .eq('funcion_id', funcionId);

    if (error) throw error;
    return data || [];
  }

  async reservarButacas(
    reservas: { funcion_id: number; fila: string; numero: number; usuario_id?: string }[],
  ) {
    const { data, error } = await this.supabase.client.from('butacas_ocupadas').insert(reservas);

    if (error) throw error;
    return data;
  }

  async obtenerFunciones() {
    const { data, error } = await this.supabase.client
      .from('funciones')
      .select('*, peliculas(*), salas(*)');

    if (error) throw error;
    return data || [];
  }

  async cambiarVisibilidadPelicula(id: number, activa: boolean) {
    const { data, error } = await this.supabase.client
      .from('peliculas')
      .update({ activa: activa })
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error al actualizar visibilidad en Supabase:', error);
      throw error;
    }
    return data;
  }

  async obtenerPeliculasActivas() {
    const { data, error } = await this.supabase.client
      .from('peliculas')
      .select('*')
      .or('activa.eq.true,activa.is.null');

    if (error) throw error;
    return data || [];
  }

  async obtenerTopPeliculasMasVendidas() {
    const peliculas = await this.obtenerPeliculasActivas();

    const { data: funciones } = await this.supabase.client
      .from('funciones')
      .select('id, pelicula_id');
    const { data: ocupadas } = await this.supabase.client
      .from('butacas_ocupadas')
      .select('funcion_id');

    if (!funciones || !ocupadas) return peliculas.slice(0, 3);

    const ventasPorPelicula: { [peliculaId: number]: number } = {};

    ocupadas.forEach((b: any) => {
      const funcion = funciones.find((f) => Number(f.id) === Number(b.funcion_id));
      if (funcion) {
        const peliId = Number(funcion.pelicula_id);
        ventasPorPelicula[peliId] = (ventasPorPelicula[peliId] || 0) + 1;
      }
    });

    const peliculasOrdenadas = peliculas
      .map((p) => ({
        ...p,
        entradasVendidas: ventasPorPelicula[Number(p.id)] || 0,
      }))
      .sort((a, b) => b.entradasVendidas - a.entradasVendidas);

    return peliculasOrdenadas.slice(0, 3);
  }

  async obtenerProximosEstrenos() {
    const hoy = new Date().toISOString().split('T')[0];

    const { data, error } = await this.supabase.client
      .from('peliculas')
      .select('*')
      .gt('fecha_estreno', hoy)
      .order('fecha_estreno', { ascending: true });

    if (error) {
      console.error('Error al obtener próximos estrenos:', error);
      return [];
    }
    return data || [];
  }

  async activarAlertaEstreno(peliculaId: number, usuarioEmail: string) {
    const { data, error } = await this.supabase.client
      .from('alertas_estreno')
      .insert([{ pelicula_id: peliculaId, email_usuario: usuarioEmail }]);

    if (error) throw error;
    return data;
  }

  // --- CANDY BAR ---

  async obtenerProductosCandy() {
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

  async guardarProductoCandy(producto: {
    id?: number;
    nombre: string;
    descripcion?: string;
    precio: number;
    categoria: string;
    imagen_url?: string;
    es_combo?: boolean;
  }) {
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

  async cambiarVisibilidadProductoCandy(id: number, activo: boolean) {
    const { data, error } = await this.supabase.client
      .from('candy_bar')
      .update({ activo: activo })
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error al cambiar visibilidad de producto:', error);
      throw error;
    }
    return data;
  }

  // --- REGISTRO DE COMPRA (SOLO BUTACAS_OCUPADAS) ---

  async guardarCompra(compra: {
    funcion_id: number;
    butacas: any[];
  }) {
    const reservas = compra.butacas.map(b => ({
      funcion_id: Number(compra.funcion_id),
      fila: String(b.fila),
      numero: Number(b.numero)
    }));

    const { data, error } = await this.supabase.client
      .from('butacas_ocupadas')
      .insert(reservas)
      .select();

    if (error) {
      console.error('Error al insertar en butacas_ocupadas:', error);
      throw error;
    }

    return data;
  }
}