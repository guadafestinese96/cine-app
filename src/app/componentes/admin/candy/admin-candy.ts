import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CandyService } from '../../../services/candy';
import { AvisosService } from '../../../services/avisos';
import { CATEGORIAS_CANDY, Combo, ProductoCandy } from '../../../core/modelos';
import { errorLegible } from '../../../core/utilidades';

@Component({
  selector: 'app-admin-candy',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-candy.html',
  styles: `
    .bloque { margin-bottom: 48px; }
    .categoria { margin: 20px 0 4px; font-size: 0.85rem; color: var(--bronce-claro); }
  `,
})
export class AdminCandyComponent {
  private srv = inject(CandyService);
  private avisos = inject(AvisosService);
  private fb = inject(FormBuilder).nonNullable;

  readonly categoriasBase = CATEGORIAS_CANDY;

  productos = signal<ProductoCandy[]>([]);
  combos = signal<Combo[]>([]);
  productoEditando = signal<ProductoCandy | null>(null);
  comboEditando = signal<Combo | null>(null);

  categorias = computed(() => [...new Set([...this.categoriasBase, ...this.productos().map((p) => p.categoria).filter(Boolean)])]);
  porCategoria = computed(() =>
    this.categorias()
      .map((c) => ({ categoria: c, productos: this.productos().filter((p) => p.categoria === c) }))
      .filter((g) => g.productos.length),
  );

  formProducto = this.fb.group({
    nombre: ['', Validators.required],
    descripcion: [''],
    precio: [0, [Validators.required, Validators.min(1)]],
    categoria: ['Pochoclos', Validators.required],
    imagen_url: [''],
  });

  formCombo = this.fb.group({
    nombre: ['', Validators.required],
    incluye: ['Entrada + Pochoclo grande + Gaseosa grande', Validators.required],
    descripcion: [''],
    precio: [0, [Validators.required, Validators.min(1)]],
    imagen_url: [''],
  });

  constructor() {
    this.cargar();
  }

  async cargar() {
    try {
      const [productos, combos] = await Promise.all([this.srv.obtenerProductos(true), this.srv.obtenerCombos(true)]);
      this.productos.set(productos);
      this.combos.set(combos);
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }

  // --------------------------------------------------------- Productos
  editarProducto(p: ProductoCandy) {
    this.productoEditando.set(p);
    this.formProducto.setValue({
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      precio: p.precio,
      categoria: p.categoria || 'Pochoclos',
      imagen_url: p.imagen_url ?? '',
    });
  }

  nuevoProducto() {
    this.productoEditando.set(null);
    this.formProducto.reset();
  }

  async guardarProducto() {
    if (this.formProducto.invalid) {
      this.formProducto.markAllAsTouched();
      return;
    }
    try {
      await this.srv.guardarProducto({ ...this.formProducto.getRawValue(), id: this.productoEditando()?.id });
      this.avisos.exito(this.productoEditando() ? 'Producto actualizado.' : 'Producto creado.');
      this.nuevoProducto();
      await this.cargar();
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }

  async alternarProducto(p: ProductoCandy) {
    try {
      await this.srv.cambiarVisibilidad(p, p.activo === false);
      await this.cargar();
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }

  // ------------------------------------------------------------ Combos
  editarCombo(c: Combo) {
    this.comboEditando.set(c);
    this.formCombo.setValue({
      nombre: c.nombre,
      incluye: c.incluye ?? '',
      descripcion: c.descripcion ?? '',
      precio: c.precio,
      imagen_url: c.imagen_url ?? '',
    });
  }

  nuevoCombo() {
    this.comboEditando.set(null);
    this.formCombo.reset();
  }

  async guardarCombo() {
    if (this.formCombo.invalid) {
      this.formCombo.markAllAsTouched();
      return;
    }
    try {
      await this.srv.guardarCombo({ ...this.formCombo.getRawValue(), id: this.comboEditando()?.id });
      this.avisos.exito(this.comboEditando() ? 'Combo actualizado.' : 'Combo creado.');
      this.nuevoCombo();
      await this.cargar();
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }

  async alternarCombo(c: Combo) {
    try {
      await this.srv.cambiarVisibilidadCombo(c, c.activo === false);
      await this.cargar();
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }
}
