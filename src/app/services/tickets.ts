import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';
import { Compra } from '../core/modelos';
import { calcularEdad, clasificacionDe, edadMinima, formatearFuncion, formatearPesos } from '../core/utilidades';

/** Genera el QR (sin servicios externos, funciona offline) y el PDF de la entrada. */
@Injectable({ providedIn: 'root' })
export class TicketsService {
  async qr(texto: string, tamano = 320): Promise<string> {
    const modulo: any = await import('qrcode');
    const QRCode = modulo.default ?? modulo;
    return QRCode.toDataURL(texto, {
      width: tamano,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#2A0A12', light: '#FFFFFF' },
    });
  }

  private sb = inject(SupabaseService).client;

  /**
   * La entrada aclara que se debe ir con un adulto cuando:
   * - quien compró con su cuenta es menor de 18 (cualquier película, también ATP), o
   * - la película tiene restricción de edad (+13 / +18).
   */
  async requiereAdulto(compra: Compra): Promise<boolean> {
    return (await this.compradorEsMenor(compra)) || edadMinima(clasificacionDe(compra.funciones?.peliculas)) > 0;
  }

  async compradorEsMenor(compra: Compra): Promise<boolean> {
    if (!compra.usuario_id) return false;
    const { data } = await this.sb.from('usuarios').select('fecha_nacimiento').eq('id', compra.usuario_id).maybeSingle();
    const edad = calcularEdad(data?.fecha_nacimiento);
    return edad !== null && edad < 18;
  }

  textoAdulto(compra: Compra, esMenor: boolean): string {
    const clasif = clasificacionDe(compra.funciones?.peliculas);
    return esMenor
      ? 'Comprador/a menor de edad: debe ingresar acompañado/a de un adulto.'
      : `Película ${clasif}: menores de edad deben ingresar acompañados de un adulto.`;
  }

  async descargarPdf(compra: Compra) {
    const { jsPDF } = await import('jspdf');
    const qr = await this.qr(compra.codigo, 480);
    const f = compra.funciones;
    const p = f?.peliculas;

    const ancho = 100;
    const doc = new jsPDF({ unit: 'mm', format: [ancho, 200] });
    const margen = 8;
    let y = 0;

    // Cabecera bordó
    doc.setFillColor(74, 14, 28);
    doc.rect(0, 0, ancho, 30, 'F');
    doc.setTextColor(212, 166, 74);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('CINEWIDI', margen, 13);
    doc.setFontSize(8);
    doc.setTextColor(243, 233, 210);
    doc.setFont('helvetica', 'normal');
    doc.text('Entrada y retiro de candy bar', margen, 20);
    doc.text(`Compra ${compra.codigo}`, margen, 25);

    // Película
    y = 42;
    doc.setTextColor(42, 10, 18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    const titulo = doc.splitTextToSize(p?.nombre ?? 'Película', ancho - margen * 2);
    doc.text(titulo, margen, y);
    y += titulo.length * 6 + 2;

    const filas: [string, string][] = [
      ['Función', f ? formatearFuncion(f.fecha_hora) : '-'],
      ['Sala', f?.salas?.nombre ?? `Sala ${f?.sala_id ?? ''}`],
      ['Formato', `${f?.formato ?? '2D'} · ${f?.idioma ?? 'Castellano'}`],
      ['Butacas', compra.butacas.map((b) => `${b.fila}${b.numero}${b.tipo === 'vip' ? ' VIP' : b.tipo === 'adaptada' ? ' (accesible)' : ''}`).join(', ')],
    ];
    doc.setFontSize(9);
    for (const [etiqueta, valor] of filas) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 90, 90);
      doc.text(etiqueta, margen, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(42, 10, 18);
      const lineas = doc.splitTextToSize(valor, ancho - margen * 2 - 22);
      doc.text(lineas, margen + 22, y);
      y += lineas.length * 4.5 + 1.5;
    }

    const candy = [...(compra.combos ?? []), ...(compra.productos ?? [])];
    if (candy.length) {
      y += 2;
      doc.setFont('helvetica', 'bold');
      doc.text('Candy bar', margen, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      for (const item of candy) {
        const texto = `${item.cantidad} × ${item.nombre}${item.incluye ? ` (${item.incluye})` : ''}`;
        const lineas = doc.splitTextToSize(texto, ancho - margen * 2);
        doc.text(lineas, margen, y);
        y += lineas.length * 4.5;
      }
    }

    const esMenor = await this.compradorEsMenor(compra);
    if (esMenor || edadMinima(clasificacionDe(p)) > 0) {
      y += 3;
      doc.setFillColor(253, 236, 200);
      doc.roundedRect(margen, y - 4, ancho - margen * 2, 11, 2, 2, 'F');
      doc.setTextColor(120, 60, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(this.textoAdulto(compra, esMenor), margen + 3, y + 2.5, {
        maxWidth: ancho - margen * 2 - 6,
      });
      y += 10;
    }

    // Línea troquelada
    y += 6;
    doc.setDrawColor(180, 150, 150);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(margen, y, ancho - margen, y);
    doc.setLineDashPattern([], 0);

    // QR
    y += 6;
    const lado = 56;
    doc.addImage(qr, 'PNG', (ancho - lado) / 2, y, lado, lado);
    y += lado + 6;
    doc.setTextColor(42, 10, 18);
    doc.setFont('courier', 'bold');
    doc.setFontSize(12);
    doc.text(compra.codigo, ancho / 2, y, { align: 'center' });
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 90, 90);
    doc.text('Mostrá este QR en la sala y en el candy bar. Cada uso se valida una sola vez.', ancho / 2, y, {
      align: 'center',
      maxWidth: ancho - margen * 2,
    });
    y += 8;
    doc.text(`Total abonado ${formatearPesos(compra.total_pagado)}`, ancho / 2, y, { align: 'center' });

    doc.save(`CineWidi_${compra.codigo}.pdf`);
  }
}
