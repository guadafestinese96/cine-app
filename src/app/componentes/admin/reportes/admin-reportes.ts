import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FilaDia, Periodo, ReportesService } from '../../../services/reportes';
import { AvisosService } from '../../../services/avisos';
import { Compra } from '../../../core/modelos';
import { aFechaIso, errorLegible, inicioDelDia, nombreMes, parsearFechaLocal, sumarDias } from '../../../core/utilidades';

/**
 * Facturación por día (con exportación a PDF y Excel), películas más vistas por semana o mes
 * y producto del candy más vendido.
 */
@Component({
  selector: 'app-admin-reportes',
  imports: [DatePipe],
  templateUrl: './admin-reportes.html',
  styleUrl: './admin-reportes.css',
})
export class AdminReportesComponent {
  private srv = inject(ReportesService);
  private avisos = inject(AvisosService);

  cargando = signal(true);
  compras = signal<Compra[]>([]);
  dias = signal(30);
  periodo = signal<Periodo>('semana');
  referencia = signal(new Date());
  vista = signal<'grafico' | 'tabla'>('grafico');

  desdeFacturacion = computed(() => sumarDias(inicioDelDia(new Date()), -(this.dias() - 1)));

  filas = computed(() => {
    const desde = this.desdeFacturacion();
    return this.srv.porDia(this.compras().filter((c) => new Date(c.created_at!) >= desde));
  });

  /** Serie completa de días (incluye los días sin ventas en 0) para el gráfico */
  serie = computed(() => {
    const mapa = new Map<string, FilaDia>(this.filas().map((f) => [f.dia, f] as [string, FilaDia]));
    return Array.from({ length: this.dias() }, (_, i) => {
      const fecha = sumarDias(this.desdeFacturacion(), i);
      const clave = aFechaIso(fecha);
      return { fecha, clave, facturado: mapa.get(clave)?.facturado ?? 0, entradas: mapa.get(clave)?.entradas ?? 0 };
    });
  });
  maximo = computed(() => Math.max(1, ...this.serie().map((d) => d.facturado)));

  totales = computed(() =>
    this.filas().reduce(
      (t, f) => ({
        facturado: t.facturado + f.facturado,
        entradas: t.entradas + f.entradas,
        compras: t.compras + f.compras,
        canceladas: t.canceladas + f.canceladas,
      }),
      { facturado: 0, entradas: 0, compras: 0, canceladas: 0 },
    ),
  );

  rango = computed(() => this.srv.rango(this.periodo(), this.referencia()));
  nombrePeriodo = computed(() => {
    const { desde, hasta } = this.rango();
    if (this.periodo() === 'mes') return `${nombreMes(desde.getMonth())} ${desde.getFullYear()}`;
    const fin = sumarDias(hasta, -1);
    return `Semana del ${desde.getDate()}/${desde.getMonth() + 1} al ${fin.getDate()}/${fin.getMonth() + 1}`;
  });
  peliculas = computed(() => this.srv.peliculasMasVistas(this.compras(), this.rango().desde, this.rango().hasta).slice(0, 8));
  productos = computed(() => this.srv.productosMasVendidos(this.compras(), this.rango().desde, this.rango().hasta).slice(0, 8));
  maxPeliculas = computed(() => Math.max(1, ...this.peliculas().map((p) => p.cantidad)));
  maxProductos = computed(() => Math.max(1, ...this.productos().map((p) => p.cantidad)));

  constructor() {
    this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    try {
      // Se traen 6 meses para poder navegar semanas y meses anteriores
      this.compras.set(await this.srv.compras(sumarDias(new Date(), -186)));
    } catch (e) {
      this.avisos.error(errorLegible(e));
    } finally {
      this.cargando.set(false);
    }
  }

  moverPeriodo(paso: number) {
    const r = new Date(this.referencia());
    if (this.periodo() === 'semana') r.setDate(r.getDate() + paso * 7);
    else r.setMonth(r.getMonth() + paso, 1);
    this.referencia.set(r);
  }

  elegirPeriodo(p: Periodo) {
    this.periodo.set(p);
    this.referencia.set(new Date());
  }

  esPeriodoActual() {
    return this.rango().hasta.getTime() > Date.now();
  }

  fechaFila(dia: string) {
    return parsearFechaLocal(dia);
  }

  private nombreArchivo() {
    return `facturacion_${aFechaIso(this.desdeFacturacion())}_${aFechaIso(new Date())}`;
  }

  async exportarPdf() {
    try {
      await this.srv.exportarPdf(this.filas(), `Últimos ${this.dias()} días · generado por CineWidi`, this.nombreArchivo());
    } catch (e) {
      this.avisos.error('No se pudo exportar el PDF. ' + errorLegible(e));
    }
  }

  async exportarExcel() {
    try {
      await this.srv.exportarExcel(this.filas(), this.nombreArchivo());
    } catch (e) {
      this.avisos.error('No se pudo exportar el Excel. ' + errorLegible(e));
    }
  }
}
