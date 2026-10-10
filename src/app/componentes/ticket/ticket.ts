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
  porcentajeDescuento = 0;
  
  codigoCuponInput = '';
  mensajeCupon = '';
  
  usuarioLogueado: any = null;
  compraFinalizada = false;
  codigoQR = '';
  puntosGanadosEstaCompra = 0;
  
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

    const descPrevio = localStorage.getItem('descuento_aplicado');
    if (descPrevio) {
      this.porcentajeDescuento = Number(descPrevio);
    }
  }

  verificarUsuarioLogueado() {
    const usrStorage = localStorage.getItem('usuario_logueado');
    if (usrStorage) {
      try {
        this.usuarioLogueado = JSON.parse(usrStorage);
        
        // RF-14: Aplicar 20% automático si es la primera compra y no tenía descuento previo seleccionado
        if (this.usuarioLogueado && !this.usuarioLogueado.primer_compra_realizada && this.porcentajeDescuento === 0) {
          this.porcentajeDescuento = 20;
          this.mensajeCupon = '🎉 ¡Se aplicó automáticamente tu 20% de descuento de Bienvenida por primera compra!';
          localStorage.setItem('descuento_aplicado', '20');
        }
      } catch (e) {
        console.error('Error al leer datos del usuario:', e);
      }
    } else {
      this.porcentajeDescuento = 0;
      localStorage.removeItem('descuento_aplicado');
    }
  }

  aplicarCuponManual() {
    const cupon = this.codigoCuponInput.trim().toUpperCase();
    if (!cupon) return;

    if (cupon === 'BIENVENIDA20' || cupon === 'BIENVENIDA') {
      const cuponesUsados = JSON.parse(localStorage.getItem('cupones_bienvenida_usados') || '[]');
      const idUsuario = this.usuarioLogueado?.email || 'anonimo';

      if (cuponesUsados.includes(idUsuario) || this.usuarioLogueado?.primer_compra_realizada) {
        this.mensajeCupon = '❌ Ya has utilizado tu cupón de bienvenida anteriormente.';
        return;
      }

      this.porcentajeDescuento = 20;
      this.mensajeCupon = '✅ Cupón de Bienvenida (20% OFF) aplicado.';
      localStorage.setItem('descuento_aplicado', '20');
    } else if (cupon === 'MAYOR50') {
      if (this.usuarioLogueado && this.usuarioLogueado.fecha_nacimiento) {
        const edad = this.calcularEdad(this.usuarioLogueado.fecha_nacimiento);
        if (edad >= 50) {
          this.porcentajeDescuento = 25;
          this.mensajeCupon = '✅ Cupón Senior Mayores de 50 años (25% OFF) aplicado.';
          localStorage.setItem('descuento_aplicado', '25');
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

      // Puntos de Fidelidad ($1 gastado = 1 punto)
      this.puntosGanadosEstaCompra = Math.floor(this.totalPagar);

      if (this.usuarioLogueado) {
        this.usuarioLogueado.primer_compra_realizada = true;
        
        // Sumar puntos acumulados
        const puntosAnteriores = Number(this.usuarioLogueado.puntos_fidelidad || this.usuarioLogueado.puntos || 0);
        const nuevosPuntos = puntosAnteriores + this.puntosGanadosEstaCompra;
        
        this.usuarioLogueado.puntos_fidelidad = nuevosPuntos;
        this.usuarioLogueado.puntos = nuevosPuntos;

        // Persistir en LocalStorage
        localStorage.setItem('usuario_logueado', JSON.stringify(this.usuarioLogueado));

        const puntosGlobales = JSON.parse(localStorage.getItem('puntos_fidelidad_usuarios') || '{}');
        const emailKey = this.usuarioLogueado.email || 'defecto';
        puntosGlobales[emailKey] = nuevosPuntos;
        localStorage.setItem('puntos_fidelidad_usuarios', JSON.stringify(puntosGlobales));
      }

      const nuevaCompra = {
        id: this.codigoQR,
        pelicula: this.funcionSeleccionada?.peliculas?.nombre || this.funcionSeleccionada?.peliculas?.titulo,
        imagen_url: this.funcionSeleccionada?.peliculas?.imagen_url,
        sala: this.funcionSeleccionada?.salas?.nombre || 'Sala ' + this.funcionSeleccionada?.sala_id,
        fecha_hora: this.funcionSeleccionada?.fecha_hora,
        monto: this.totalPagar,
        butacas: this.butacasSeleccionadas.map(b => `${b.fila}${b.numero}`),
        puntosGanados: this.puntosGanadosEstaCompra,
        cancelada: false
      };

      const historialExistente = JSON.parse(localStorage.getItem('historial_compras') || '[]');
      historialExistente.unshift(nuevaCompra);
      localStorage.setItem('historial_compras', JSON.stringify(historialExistente));

      localStorage.removeItem('carrito_candy');
      localStorage.removeItem('descuento_aplicado');
      
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

  descargarPDF() {
    const elemento = document.getElementById('ticket-imprimible');
    if (!elemento) return;

    const opciones = {
      margin: 10,
      filename: `Ticket_Cine_${this.codigoQR}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
      setTimeout(() => {
        html2pdf().set(opciones).from(elemento).save().catch((err: any) => {
          console.error('Error generando PDF:', err);
        });
      }, 400);
    } else {
      window.print();
    }
  }

  imprimirONavegarInicio() {
    this.router.navigate(['/catalogo']);
  }
}