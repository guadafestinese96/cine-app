import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CandyService, ProductoCandy } from '../../services/candy';

@Component({
  selector: 'app-candy',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './candy.html',
  styleUrl: './candy.css'
})
export class CandyComponent implements OnInit {
  productos: ProductoCandy[] = [];
  carritoCandy: { producto: ProductoCandy; cantidad: number }[] = [];

  constructor(
    private candyService: CandyService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.recuperarCarritoExistente();
    await this.cargarProductos();
  }

  // Carga previa si el usuario ya tenía cosas elegidas
  recuperarCarritoExistente() {
    const guardado = localStorage.getItem('carrito_candy');
    if (guardado) {
      try {
        this.carritoCandy = JSON.parse(guardado);
      } catch (e) {
        this.carritoCandy = [];
      }
    }
  }

  async cargarProductos() {
    try {
      const res = await this.candyService.obtenerProductos();
      this.productos = res;
      console.log('Productos de Candy Bar cargados:', this.productos);
      this.cdr.detectChanges(); // Forzar renderizado en pantalla
    } catch (err) {
      console.error('Error al cargar productos:', err);
    }
  }

  agregarAlCarrito(prod: ProductoCandy) {
    const item = this.carritoCandy.find(c => c.producto.id === prod.id);
    if (item) {
      item.cantidad++;
    } else {
      this.carritoCandy.push({ producto: prod, cantidad: 1 });
    }
    this.guardarTemporal();
  }

  quitarDelCarrito(prod: ProductoCandy) {
    const index = this.carritoCandy.findIndex(c => c.producto.id === prod.id);
    if (index !== -1) {
      if (this.carritoCandy[index].cantidad > 1) {
        this.carritoCandy[index].cantidad--;
      } else {
        this.carritoCandy.splice(index, 1);
      }
    }
    this.guardarTemporal();
  }

  getCantidad(prodId: number): number {
    const item = this.carritoCandy.find(c => c.producto.id === prodId);
    return item ? item.cantidad : 0;
  }

  get totalCandy(): number {
    return this.carritoCandy.reduce((acc, c) => acc + (c.producto.precio * c.cantidad), 0);
  }

  guardarTemporal() {
    localStorage.setItem('carrito_candy', JSON.stringify(this.carritoCandy));
  }

  continuarAlPago() {
    this.guardarTemporal();
    this.router.navigate(['/ticket']);
  }
}