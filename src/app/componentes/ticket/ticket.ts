import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PeliculasService } from '../../services/peliculas';

declare var html2pdf: any;

@Component({
  selector: 'app-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ticket.html',
  styleUrl: './ticket.css'
})
export class TicketComponent implements OnInit {
  funcionSeleccionada: any = null;
  butacasSeleccionadas: any[] = [];
  carritoCandy: any[] = [];
  
  subtotalEntradas = 0;
  subtotalCandy = 0;
  descuentoAplicado = 0;
  porcentajeDescuento = 0;
  
  codigoCuponInput = '';
  mensajeCupon = '';
  
  usuarioLogueado: any = null;
  compraFinalizada = false;
  codigoQR = '';
  
  cargando = false;

  constructor(
    private peliculasService: PeliculasService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarDatosCompra();
    this.verificarUsuarioLogueado();
    this.cargarLibreriaPDF();
  }

  // Carga dinámica del script html2pdf si no está presente
  cargarLibreriaPDF() {
    if (typeof html2pdf === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }

  cargarDatosCompra() {
    const fnGuardada = localStorage.getItem('funcion_seleccionada');
    if (fnGuardada) this.funcionSeleccionada = JSON.parse(fnGuardada);

    const btcGuardadas = localStorage.getItem('butacas_seleccionadas');
    if (btcGuardadas) this.butacasSeleccionadas = JSON.parse(btcGuardadas);

    const candyGuardado = localStorage.getItem('carrito_candy');
    if (candyGuardado) this.carritoCandy = JSON.parse(candyGuardado);

    if (!this.funcionSeleccionada || this.butacasSeleccionadas.length === 0) {
      this.router.navigate(['/catalogo']);
      return;
    }

    this.subtotalEntradas = this.butacasSeleccionadas.reduce((acc, b) => acc + Number(b.precio), 0);
    this.subtotalCandy = this.carritoCandy.reduce((acc, c) => acc + (Number(c.producto.precio) * Number(c.cantidad)), 0);
  }

  verificarUsuarioLogueado() {
    const usrStorage = localStorage.getItem('usuario_logueado');
    if (usrStorage) {
      try {
        this.usuarioLogueado = JSON.parse(usrStorage);
        if (this.usuarioLogueado && !this.usuarioLogueado.primer_compra_realizada) {
          this.porcentajeDescuento = 20;
          this.mensajeCupon = '🎉 ¡Aprovecha tu 20% de descuento automático de Bienvenida!';
        }
      } catch (e) {
        console.error('Error al leer datos del usuario:', e);
      }
    }
  }

  aplicarCuponManual() {
    const cupon = this.codigoCuponInput.trim().toUpperCase();
    if (!cupon) return;

    if (cupon === 'BIENVENIDA20') {
      this.porcentajeDescuento = 20;
      this.mensajeCupon = '✅ Cupón de Bienvenida (20% OFF) aplicado.';
    } else if (cupon === 'MAYOR50') {
      if (this.usuarioLogueado && this.usuarioLogueado.fecha_nacimiento) {
        const edad = this.calcularEdad(this.usuarioLogueado.fecha_nacimiento);
        if (edad >= 50) {
          this.porcentajeDescuento = 25;
          this.mensajeCupon = '✅ Cupón Senior Mayores de 50 años (25% OFF) aplicado.';
        } else {
          this.mensajeCupon = '❌ Este cupón es exclusivo para clientes mayores de 50 años.';
        }
      } else {
        this.mensajeCupon = '❌ Debes registrarte con tu fecha de nacimiento para usar este cupón.';
      }
    } else {
      this.mensajeCupon = '❌ Código de cupón inválido o vencido.';
    }

    this.cdr.detectChanges();
  }

  private calcularEdad(fechaNacimiento: string): number {
    const hoy = new Date();
    const nac = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) {
      edad--;
    }
    return edad;
  }

  get subtotalGeneral(): number {
    return this.subtotalEntradas + this.subtotalCandy;
  }

  get montoDescuento(): number {
    return (this.subtotalGeneral * this.porcentajeDescuento) / 100;
  }

  get totalPagar(): number {
    return this.subtotalGeneral - this.montoDescuento;
  }

  async procesarPago() {
    this.cargando = true;
    
    const idUnico = 'CINE-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    this.codigoQR = idUnico;

    try {
      await this.peliculasService.guardarCompra({
        funcion_id: this.funcionSeleccionada.id,
        butacas: this.butacasSeleccionadas
      });

      if (this.usuarioLogueado) {
        this.usuarioLogueado.primer_compra_realizada = true;
        localStorage.setItem('usuario_logueado', JSON.stringify(this.usuarioLogueado));
      }

      localStorage.removeItem('carrito_candy');
      this.compraFinalizada = true;
    } catch (error: any) {
      console.error('Error al procesar pago:', error);
      alert(`Error al guardar en Supabase: ${error.message || 'Error al reservar butacas.'}`);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  get urlQR(): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(this.codigoQR)}`;
  }

  get requiereAcompananteAdulto(): boolean {
    const clasificacion = this.funcionSeleccionada?.peliculas?.clasificacion;
    return clasificacion === '+13' || clasificacion === '+18';
  }

  // MÉTODO PARA DESCARGAR EL TICKET EN PDF (RF-16) con espera para la carga del QR
  descargarPDF() {
    const elemento = document.getElementById('ticket-imprimible');
    if (!elemento) return;

    const opciones = {
      margin: 10,
      filename: `Ticket_Cine_${this.codigoQR}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true,
        scrollY: 0 
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
      setTimeout(() => {
        html2pdf().set(opciones).from(elemento).save().catch((err: any) => {
          console.error('Error generando PDF:', err);
        });
      }, 400); // Retraso de 400ms para asegurar la renderización completa del QR externo
    } else {
      window.print(); // Fallback directo si no carga la librería
    }
  }

  imprimirONavegarInicio() {
    this.router.navigate(['/catalogo']);
  }
}