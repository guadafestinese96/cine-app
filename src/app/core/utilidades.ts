import { Pelicula } from './modelos';

/**
 * Las funciones se guardan como "hora de pared" del cine (ej. 2026-11-02T18:00:00).
 * Si la columna devuelve zona horaria (Z o +00:00) se ignora, así 18:00 siempre es 18:00
 * sin importar la zona del navegador.
 */
export function parsearFechaLocal(valor: string | Date | null | undefined): Date {
  if (!valor) return new Date(NaN);
  if (valor instanceof Date) return new Date(valor.getTime());
  const limpio = String(valor).trim().replace(' ', 'T').replace(/(Z|[+-]\d{2}:?\d{2})$/, '');
  const m = limpio.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return new Date(NaN);
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
}

/** Date → "YYYY-MM-DDTHH:mm:00" (hora local, sin zona) */
export function aIsoLocal(fecha: Date): string {
  return `${aFechaIso(fecha)}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:00`;
}

/** Date → "YYYY-MM-DD" */
export function aFechaIso(fecha: Date): string {
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

export function dos(n: number): string {
  return n.toString().padStart(2, '0');
}

export function inicioDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

export function sumarDias(fecha: Date, dias: number): Date {
  const d = new Date(fecha.getTime());
  d.setDate(d.getDate() + dias);
  return d;
}

export function sumarMinutos(fecha: Date, minutos: number): Date {
  return new Date(fecha.getTime() + minutos * 60_000);
}

export function calcularEdad(fechaNacimiento: string | null | undefined): number | null {
  if (!fechaNacimiento) return null;
  const nac = parsearFechaLocal(fechaNacimiento);
  if (isNaN(nac.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function nombreDia(fecha: Date, corto = false): string {
  return (corto ? DIAS_CORTOS : DIAS)[fecha.getDay()];
}

export function nombreMes(mes: number, corto = false): string {
  return (corto ? MESES_CORTOS : MESES)[mes];
}

export function formatearHora(fecha: Date): string {
  return `${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

/** "Lun 3 nov · 18:30" */
export function formatearFuncion(valor: string | Date): string {
  const f = parsearFechaLocal(valor);
  if (isNaN(f.getTime())) return '';
  return `${nombreDia(f, true)} ${f.getDate()} ${nombreMes(f.getMonth(), true)}, ${formatearHora(f)} h`;
}

/** "Hoy", "Mañana" o "Lun 3 nov" */
export function etiquetaDia(fecha: Date): string {
  const hoy = inicioDelDia(new Date());
  const dia = inicioDelDia(fecha);
  const diff = Math.round((dia.getTime() - hoy.getTime()) / 86_400_000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  return `${nombreDia(fecha, true)} ${fecha.getDate()} ${nombreMes(fecha.getMonth(), true)}`;
}

export function formatearPesos(valor: number | null | undefined): string {
  const n = Number(valor || 0);
  return '$' + n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

export function generarCodigo(prefijo: string): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const valores = new Uint32Array(8);
  crypto.getRandomValues(valores);
  let codigo = '';
  valores.forEach((v) => (codigo += alfabeto[v % alfabeto.length]));
  return `${prefijo}-${codigo}`;
}

/** El campo genero puede venir como array, JSON en texto o texto simple. */
export function normalizarGeneros(genero: Pelicula['genero']): string[] {
  if (!genero) return [];
  if (Array.isArray(genero)) return genero;
  const texto = String(genero).trim();
  if (texto.startsWith('[')) {
    try {
      return JSON.parse(texto);
    } catch {
      /* sigue abajo */
    }
  }
  if (texto.startsWith('{')) return texto.slice(1, -1).split(',').map((g) => g.replace(/"/g, '').trim());
  return texto.split(',').map((g) => g.trim()).filter(Boolean);
}

/** Edad mínima según la clasificación (ATP = 0) */
export function edadMinima(clasificacion: string | number | null | undefined): number {
  const m = String(clasificacion ?? '').match(/\d+/);
  return m ? Number(m[0]) : 0;
}

/** La clasificación puede venir en "clasificacion" (+13) o, en datos viejos, en "restriccion_edad" (13). */
export function clasificacionDe(p: any): string {
  const valor = p?.clasificacion ?? p?.restriccion_edad;
  if (valor === null || valor === undefined || valor === '') return 'ATP';
  return /^\d+$/.test(String(valor).trim()) ? `+${String(valor).trim()}` : String(valor);
}

export function errorLegible(error: unknown): string {
  const e = error as { message?: string };
  return e?.message || 'Ocurrió un error inesperado. Probá de nuevo.';
}
