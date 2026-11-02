// Modelos de dominio de CineWidi (coinciden con las tablas de Supabase)

export type Rol = 'cliente' | 'empleado' | 'admin';
export type Formato = '2D' | '3D' | '4D' | '5D';
export type Idioma = 'Castellano' | 'Subtitulada';
export type TipoButaca = 'estandar' | 'adaptada' | 'vip';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento?: string | null;
  tipo_sangre?: string | null;
  color_ojos?: string | null;
  dias_vacaciones?: number | null;
  rol: Rol;
  puntos: number;
  credito: number;
}

export interface Pelicula {
  id: number;
  nombre: string;
  sinopsis: string;
  duracion_minutos: number;
  genero: string[] | string | null;
  clasificacion: string; // ATP | +13 | +18
  imagen_url: string;
  fecha_estreno?: string | null;
  activa?: boolean | null;
  preventa_activa?: boolean;
  precio_preventa?: number | null;
}

export interface Sala {
  id: number;
  nombre: string;
  activa?: boolean;
  butacas_bloqueadas?: string[];
}

export interface Funcion {
  id: number;
  pelicula_id: number;
  sala_id: number;
  fecha_hora: string;
  formato: Formato | string;
  idioma: Idioma | string;
  precio_base?: number | null;
  activa?: boolean;
  peliculas?: Pelicula;
  salas?: Sala;
}

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

export interface Combo {
  id?: number;
  nombre: string;
  descripcion?: string;
  incluye?: string;
  precio: number;
  imagen_url?: string;
  activo?: boolean;
}

export interface ButacaElegida {
  fila: string;
  numero: number;
  tipo: TipoButaca;
  precio: number;
}

export interface ItemCarrito {
  id: number;
  nombre: string;
  cantidad: number;
  precio: number;
  incluye?: string;
}

export interface Compra {
  id?: number;
  codigo: string;
  usuario_id?: string | null;
  email?: string | null;
  nombre?: string | null;
  funcion_id: number;
  pelicula_id?: number;
  butacas: ButacaElegida[];
  productos: ItemCarrito[];
  combos: ItemCarrito[];
  cantidad_entradas: number;
  subtotal: number;
  descuento: number;
  cupon_codigo?: string | null;
  canje_codigo?: string | null;
  credito_usado: number;
  total_pagado: number;
  metodo_pago?: string | null;
  puntos_ganados: number;
  estado: 'pagada' | 'cancelada';
  entrada_validada_at?: string | null;
  candy_entregado_at?: string | null;
  cancelada_at?: string | null;
  created_at?: string;
  funciones?: Funcion;
}

export interface Resena {
  id?: number;
  pelicula_id: number;
  usuario_id: string;
  autor: string;
  estrellas: number;
  comentario?: string;
  created_at?: string;
}

export interface Cupon {
  id?: number;
  codigo: string;
  descripcion?: string;
  porcentaje: number;
  tipo: 'bienvenida' | 'mayores_50' | 'general';
  activo: boolean;
}

export interface Recompensa {
  id?: number;
  nombre: string;
  tipo: 'entrada' | 'producto';
  puntos: number;
  activa: boolean;
}

export interface Canje {
  id?: number;
  codigo: string;
  usuario_id: string;
  recompensa_id?: number;
  nombre: string;
  tipo: 'entrada' | 'producto';
  puntos: number;
  usado: boolean;
  usado_at?: string | null;
  created_at?: string;
}

export interface LogActividad {
  id?: number;
  usuario_email?: string | null;
  accion: string;
  detalle?: string;
  created_at?: string;
}

export const FORMATOS: Formato[] = ['2D', '3D', '4D', '5D'];
export const IDIOMAS: Idioma[] = ['Castellano', 'Subtitulada'];
export const CLASIFICACIONES = ['ATP', '+13', '+18'];
export const GENEROS = [
  'Acción', 'Aventura', 'Animación', 'Ciencia Ficción', 'Comedia',
  'Drama', 'Fantasía', 'Musical', 'Romance', 'Suspenso', 'Terror', 'Documental',
];
export const CATEGORIAS_CANDY = ['Pochoclos', 'Bebidas', 'Golosinas', 'Snacks'];
