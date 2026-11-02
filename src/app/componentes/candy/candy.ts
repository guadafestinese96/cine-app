import { ImagenRespaldoDirective } from '../compartidos/imagen-respaldo';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CandyService } from '../../services/candy';
import { ComprasService } from '../../services/compras';
import { FuncionesService } from '../../services/funciones';
import { PeliculasService } from '../../services/peliculas';
import { ConfiguracionService } from '../../services/configuracion';
import { AvisosService } from '../../services/avisos';
import { Combo, Funcion, ProductoCandy } from '../../core/modelos';
import { errorLegible, formatearFuncion } from '../../core/utilidades';

@Component({
  selector: 'app-candy',
  imports: [ImagenRespaldoDirective, RouterLink],
  templateUrl: './candy.html',
  styleUrl: './candy.css',
})
export class CandyComponent {
  private candySrv = inject(CandyService);
  private funcionesSrv = inject(FuncionesService);
  private peliculasSrv = inject(PeliculasService);
  private config = inject(ConfiguracionService);
  private avisos = inject(AvisosService);
  private router = inject(Router);
  compras = inject(ComprasService);

  cargando = signal(true);
  funcion = signal<Funcion | null>(null);
  productos = signal<ProductoCandy[]>([]);
  combos = signal<Combo[]>([]);
  categoria = signal('Todas');

  categorias = computed(() => ['Todas', ...new Set(this.productos().map((p) => p.categoria || 'Otros'))]);
  productosVisibles = computed(() =>
    this.categoria() === 'Todas' ? this.productos() : this.productos().filter((p) => (p.categoria || 'Otros') === this.categoria()),
  );

  precioEstandar = computed(() => this.peliculasSrv.precioEntrada(this.funcion()?.peliculas, this.funcion()));
  combosDisponibles = computed(() => this.compras.cantidadEntradas() - this.compras.cantidadCombos());

  totales = computed(() =>
    this.compras.calcularTotales(this.compras.enCurso(), {
      precioEstandar: this.precioEstandar(),
      porcentajeCupon: 0,
      usarCanjeEntrada: false,
      creditoDisponible: 0,
      usarCredito: false,
      registrado: false,
    }),
  );

  butacasTexto = computed(() => this.compras.enCurso().butacas.map((b) => b.fila + b.numero).join(', '));

  descripcion = computed(() => {
    const f = this.funcion();
    return f ? `${f.peliculas?.nombre} · ${formatearFuncion(f.fecha_hora)} · ${f.salas?.nombre ?? 'Sala ' + f.sala_id}` : '';
  });

  async ngOnInit() {
    // Sin compra en curso la pantalla funciona como menú del candy bar (solo para ver)
    const c = this.compras.enCurso();
    const comprando = !!c.funcionId && c.butacas.length > 0;
    try {
      await this.config.cargar();
      const [funcion, productos, combos] = await Promise.all([
        comprando ? this.funcionesSrv.obtener(c.funcionId!) : Promise.resolve(null),
        this.candySrv.obtenerProductos(),
        this.candySrv.obtenerCombos(),
      ]);
      this.funcion.set(funcion);
      this.productos.set(productos);
      this.combos.set(combos);
    } catch (e) {
      this.avisos.error(errorLegible(e));
    } finally {
      this.cargando.set(false);
    }
  }

  sumarProducto(p: ProductoCandy, delta: number) {
    this.compras.cambiarCantidad('productos', { id: p.id!, nombre: p.nombre, precio: p.precio }, delta);
  }

  sumarCombo(c: Combo, delta: number) {
    if (delta > 0 && this.combosDisponibles() <= 0) {
      this.avisos.mostrar('Cada combo incluye una entrada: ya tenés un combo por cada butaca elegida.');
      return;
    }
    this.compras.cambiarCantidad('combos', { id: c.id!, nombre: c.nombre, precio: c.precio, incluye: c.incluye }, delta);
  }

  continuar() {
    this.router.navigate(['/pago']);
  }
}
