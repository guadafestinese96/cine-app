import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CandyService, ProductoCandy } from '../../services/candy';

@Component({
  selector: 'app-candy',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './candy.html',
  styleUrl: './candy.css'
})
export class CandyComponent implements OnInit {
  productos: ProductoCandy[] = [];
  carritoCandy: { producto: ProductoCandy; cantidad: number }[] = [];

  // Variables para la lógica de cupones (RF-14 y RF-15)
  codigoCupon: string = '';
  porcentajeDescuento: number = 0;
  mensajeCuponError: string = '';
  mensajeCuponExito: string = '';

  constructor(
    private candyService: CandyService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.recuperarCarritoExistente();
    await this.cargarProductos();
  }

  recuperarCarritoExistente() {
    const guardado = localStorage.getItem('carrito_candy');
    if (guardado) {
      try {
        this.carritoCandy = JSON.parse(guardado);
      } catch (e) {
        this.carritoCandy = [];
      }
    }

    // Recuperar descuento previamente aplicado si existe
    const descuentoGuardado = localStorage.getItem('descuento_aplicado');
    if (descuentoGuardado) {
      this.porcentajeDescuento = Number(descuentoGuardado);
    }
  }

  async cargarProductos() {
    try {
      const res = await this.candyService.obtenerProductos();
      this.productos = res;
      this.cdr.detectChanges();
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

  // Acepta el objeto ProductoCandy completo para evitar errores de type 'number | undefined'
  getCantidad(prod: ProductoCandy): number {
    if (!prod || prod.id === undefined) return 0;
    const item = this.carritoCandy.find(c => c.producto.id === prod.id);
    return item ? item.cantidad : 0;
  }

  get subtotalCandy(): number {
    return this.carritoCandy.reduce((acc, c) => acc + (c.producto.precio * c.cantidad), 0);
  }

  get montoDescuento(): number {
    return (this.subtotalCandy * this.porcentajeDescuento) / 100;
  }

  get totalCandy(): number {
    return this.subtotalCandy - this.montoDescuento;
  }

  // RF-14 y RF-15: Lógica de Cupones
  aplicarCupon() {
    this.mensajeCuponError = '';
    this.mensajeCuponExito = '';

    const usrStorage = localStorage.getItem('usuario_logueado');
    const usuario = usrStorage ? JSON.parse(usrStorage) : null;
    const idUsuario = usuario?.email || usuario?.id || 'anonimo';

    const cuponIngresado = this.codigoCupon.trim().toUpperCase();

    // RF-14: Cupón de bienvenida (20% por defecto)
    if (cuponIngresado === 'BIENVENIDA' || cuponIngresado === 'BIENVENIDA20') {
      const cuponesUsados = JSON.parse(localStorage.getItem('cupones_bienvenida_usados') || '[]');

      if (cuponesUsados.includes(idUsuario)) {
        this.mensajeCuponError = 'Ya has utilizado tu cupón de bienvenida anteriormente.';
        return;
      }

      this.porcentajeDescuento = 20; // 20% por consigna RF-14
      this.mensajeCuponExito = '¡Cupón de bienvenida del 20% aplicado con éxito!';

      cuponesUsados.push(idUsuario);
      localStorage.setItem('cupones_bienvenida_usados', JSON.stringify(cuponesUsados));
      localStorage.setItem('descuento_aplicado', '20');
      return;
    }

    // RF-15: Cupón segmentado para mayores de 50 años
    if (cuponIngresado === 'MAYOR50') {
      if (!usuario || !usuario.fecha_nacimiento) {
        this.mensajeCuponError = 'Debes estar registrado y tener tu fecha de nacimiento en el perfil para usar este cupón.';
        return;
      }

      const hoy = new Date();
      const nac = new Date(usuario.fecha_nacimiento);
      let edad = hoy.getFullYear() - nac.getFullYear();
      const m = hoy.getMonth() - nac.getMonth();
      if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;

      if (edad < 50) {
        this.mensajeCuponError = 'Este cupón exclusivo es válido únicamente para usuarios mayores de 50 años.';
        return;
      }

      this.porcentajeDescuento = 25; // Descuento exclusivo Senior
      this.mensajeCuponExito = '¡Cupón Senior (+50 años) del 25% aplicado con éxito!';
      localStorage.setItem('descuento_aplicado', '25');
      return;
    }

    this.mensajeCuponError = 'El código del cupón ingresado no es válido.';
  }

  guardarTemporal() {
    localStorage.setItem('carrito_candy', JSON.stringify(this.carritoCandy));
  }

  continuarAlPago() {
    this.guardarTemporal();
    this.router.navigate(['/ticket']);
  }
}