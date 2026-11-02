import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';
import { Compra } from '../core/modelos';
import { aFechaIso, inicioDelDia, parsearFechaLocal, sumarDias } from '../core/utilidades';

export interface FilaDia {
  dia: string; // YYYY-MM-DD
  facturado: number;
  entradas: number;
  compras: number;
  canceladas: number;
}

export interface Ranking {
  nombre: string;
  cantidad: number;
}

export type Periodo = 'semana' | 'mes';

/**
 * Reportes del admin.
 * Facturación = dinero cobrado ese día (total_pagado). Como las cancelaciones devuelven crédito
 * y no dinero, lo cobrado sigue contando; el crédito usado después no se vuelve a facturar.
 */
@Injectable({ providedIn: 'root' })
export class ReportesService {
  private sb = inject(SupabaseService).client;

  async compras(desde: Date): Promise<Compra[]> {
    const { data, error } = await this.sb
      .from('compras')
      .select('*, funciones(fecha_hora, pelicula_id, peliculas(id, nombre))')
      .gte('created_at', desde.toISOString())
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Compra[];
  }

  porDia(compras: Compra[]): FilaDia[] {
    const mapa = new Map<string, FilaDia>();
    for (const c of compras) {
      const dia = aFechaIso(new Date(c.created_at!));
      const fila = mapa.get(dia) ?? { dia, facturado: 0, entradas: 0, compras: 0, canceladas: 0 };
      fila.facturado += Number(c.total_pagado || 0);
      if (c.estado === 'cancelada') fila.canceladas++;
      else {
        fila.compras++;
        fila.entradas += Number(c.cantidad_entradas || 0);
      }
      mapa.set(dia, fila);
    }
    return [...mapa.values()].sort((a, b) => b.dia.localeCompare(a.dia));
  }

  rango(periodo: Periodo, referencia: Date): { desde: Date; hasta: Date } {
    const base = inicioDelDia(referencia);
    if (periodo === 'semana') {
      const lunes = sumarDias(base, -((base.getDay() + 6) % 7));
      return { desde: lunes, hasta: sumarDias(lunes, 7) };
    }
    const desde = new Date(base.getFullYear(), base.getMonth(), 1);
    return { desde, hasta: new Date(base.getFullYear(), base.getMonth() + 1, 1) };
  }

  /** Películas más vistas: entradas no canceladas de funciones dentro del período. */
  peliculasMasVistas(compras: Compra[], desde: Date, hasta: Date): Ranking[] {
    const mapa = new Map<string, number>();
    for (const c of compras) {
      if (c.estado === 'cancelada' || !c.funciones) continue;
      const fecha = parsearFechaLocal(c.funciones.fecha_hora);
      if (fecha < desde || fecha >= hasta) continue;
      const nombre = c.funciones.peliculas?.nombre ?? `Película ${c.pelicula_id}`;
      mapa.set(nombre, (mapa.get(nombre) ?? 0) + Number(c.cantidad_entradas || 0));
    }
    return this.ordenar(mapa);
  }

  productosMasVendidos(compras: Compra[], desde: Date, hasta: Date): Ranking[] {
    const mapa = new Map<string, number>();
    for (const c of compras) {
      if (c.estado === 'cancelada') continue;
      const fecha = new Date(c.created_at!);
      if (fecha < desde || fecha >= hasta) continue;
      for (const item of [...(c.productos ?? []), ...(c.combos ?? [])]) {
        mapa.set(item.nombre, (mapa.get(item.nombre) ?? 0) + Number(item.cantidad || 0));
      }
    }
    return this.ordenar(mapa);
  }

  private ordenar(mapa: Map<string, number>): Ranking[] {
    return [...mapa.entries()].map(([nombre, cantidad]) => ({ nombre, cantidad })).sort((a, b) => b.cantidad - a.cantidad);
  }

  // ------------------------------------------------------------- Exportar

  async exportarExcel(filas: FilaDia[], nombreArchivo: string) {
    const modulo: any = await import('xlsx');
    const XLSX = modulo.default ?? modulo;
    const datos = filas.map((f) => ({
      Fecha: f.dia.split('-').reverse().join('/'),
      'Facturado ($)': f.facturado,
      'Entradas vendidas': f.entradas,
      Compras: f.compras,
      Canceladas: f.canceladas,
    }));
    datos.push({
      Fecha: 'TOTAL',
      'Facturado ($)': filas.reduce((t, f) => t + f.facturado, 0),
      'Entradas vendidas': filas.reduce((t, f) => t + f.entradas, 0),
      Compras: filas.reduce((t, f) => t + f.compras, 0),
      Canceladas: filas.reduce((t, f) => t + f.canceladas, 0),
    });
    const hoja = XLSX.utils.json_to_sheet(datos);
    hoja['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 10 }, { wch: 12 }];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Facturación');
    XLSX.writeFile(libro, `${nombreArchivo}.xlsx`);
  }

  async exportarPdf(filas: FilaDia[], subtitulo: string, nombreArchivo: string) {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pesos = (n: number) => '$' + n.toLocaleString('es-AR');

    doc.setFillColor(74, 14, 28);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(212, 166, 74);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('CineWidi · Reporte de facturación', 14, 14);
    doc.setFontSize(10);
    doc.setTextColor(243, 233, 210);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitulo, 14, 22);

    const columnas = [14, 60, 110, 145, 175];
    const encabezados = ['Fecha', 'Facturado', 'Entradas vendidas', 'Compras', 'Canceladas'];
    let y = 40;
    doc.setTextColor(42, 10, 18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    encabezados.forEach((e, i) => doc.text(e, columnas[i], y));
    doc.setDrawColor(74, 14, 28);
    doc.line(14, y + 2, 196, y + 2);
    y += 8;
    doc.setFont('helvetica', 'normal');

    const escribir = (f: FilaDia | null, etiqueta?: string) => {
      const valores = f
        ? [etiqueta ?? f.dia.split('-').reverse().join('/'), pesos(f.facturado), String(f.entradas), String(f.compras), String(f.canceladas)]
        : [];
      valores.forEach((v, i) => doc.text(v, columnas[i], y));
      y += 7;
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
    };
    filas.forEach((f) => escribir(f));
    doc.line(14, y - 4, 196, y - 4);
    doc.setFont('helvetica', 'bold');
    escribir(
      {
        dia: '',
        facturado: filas.reduce((t, f) => t + f.facturado, 0),
        entradas: filas.reduce((t, f) => t + f.entradas, 0),
        compras: filas.reduce((t, f) => t + f.compras, 0),
        canceladas: filas.reduce((t, f) => t + f.canceladas, 0),
      },
      'TOTAL',
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 90, 90);
    doc.text(`Generado el ${new Date().toLocaleString('es-AR')}`, 14, 290);
    doc.save(`${nombreArchivo}.pdf`);
  }
}
