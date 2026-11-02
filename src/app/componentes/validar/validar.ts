import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ComprasService, ResultadoValidacion } from '../../services/compras';
import { TicketsService } from '../../services/tickets';
import { clasificacionDe, edadMinima, errorLegible, formatearFuncion } from '../../core/utilidades';

type Sector = 'entrada' | 'candy';

interface Registro extends ResultadoValidacion {
  codigo: string;
  avisoAdulto?: string;
  sector: Sector;
  hora: Date;
}

/**
 * Pantalla de empleados: escanea el QR con la cámara (o se tipea el código si el lector falla)
 * y lo sella para la puerta de la sala o para el candy bar.
 */
@Component({
  selector: 'app-validar',
  imports: [DatePipe],
  templateUrl: './validar.html',
  styleUrl: './validar.css',
})
export class ValidarComponent {
  private compras = inject(ComprasService);
  private tickets = inject(TicketsService);

  video = viewChild<ElementRef<HTMLVideoElement>>('video');

  sector = signal<Sector>(this.sectorGuardado());
  camaraActiva = signal(false);
  errorCamara = signal('');
  codigoManual = signal('');
  validando = signal(false);
  resultado = signal<Registro | null>(null);
  historial = signal<Registro[]>([]);

  private stream: MediaStream | null = null;
  private lienzo = document.createElement('canvas');
  private jsQR: any = null;
  private ultimoLeido = { codigo: '', momento: 0 };
  private cuadro = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.apagarCamara());
  }

  private sectorGuardado(): Sector {
    try {
      return localStorage.getItem('cinewidi_sector') === 'candy' ? 'candy' : 'entrada';
    } catch {
      return 'entrada';
    }
  }

  elegirSector(s: Sector) {
    this.sector.set(s);
    this.resultado.set(null);
    try {
      localStorage.setItem('cinewidi_sector', s);
    } catch {
      /* preferencia solo en memoria */
    }
  }

  funcionTexto(r: Registro) {
    return r.compra?.funciones ? formatearFuncion(r.compra.funciones.fecha_hora) : '';
  }

  butacas(r: Registro) {
    return (r.compra?.butacas ?? []).map((b) => `${b.fila}${b.numero}`).join(', ');
  }

  clasificacion(r: Registro) {
    return clasificacionDe(r.compra?.funciones?.peliculas);
  }

  restringida(r: Registro) {
    return edadMinima(this.clasificacion(r)) > 0;
  }

  candy(r: Registro) {
    return [...(r.compra?.combos ?? []), ...(r.compra?.productos ?? [])];
  }

  async validarManual() {
    await this.validar(this.codigoManual());
    this.codigoManual.set('');
  }

  async validar(codigo: string) {
    if (!codigo.trim() || this.validando()) return;
    this.validando.set(true);
    try {
      const r = await this.compras.validar(codigo, this.sector());
      const registro: Registro = { ...r, codigo: codigo.trim().toUpperCase(), sector: this.sector(), hora: new Date() };
      if (r.compra) {
        const esMenor = await this.tickets.compradorEsMenor(r.compra);
        if (esMenor || this.restringida(registro)) registro.avisoAdulto = this.tickets.textoAdulto(r.compra, esMenor);
      }
      this.resultado.set(registro);
      this.historial.update((h) => [registro, ...h].slice(0, 15));
      if (navigator.vibrate) navigator.vibrate(r.valido ? 80 : [60, 60, 60]);
    } catch (e) {
      this.resultado.set({ valido: false, titulo: 'Error', detalle: errorLegible(e), codigo, sector: this.sector(), hora: new Date() });
    } finally {
      this.validando.set(false);
    }
  }

  // ------------------------------------------------------------- Cámara

  async encenderCamara() {
    this.errorCamara.set('');
    try {
      if (!this.jsQR) {
        const modulo: any = await import('jsqr');
        this.jsQR = modulo.default ?? modulo;
      }
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      this.camaraActiva.set(true);
      // Espera a que el <video> aparezca en pantalla
      setTimeout(async () => {
        const v = this.video()?.nativeElement;
        if (!v || !this.stream) return;
        v.srcObject = this.stream;
        await v.play();
        this.escanear();
      });
    } catch (e: any) {
      this.errorCamara.set(
        e?.name === 'NotAllowedError'
          ? 'No hay permiso para usar la cámara. Habilitalo en el navegador o ingresá el código a mano.'
          : 'No se pudo abrir la cámara. Ingresá el código a mano.',
      );
      this.apagarCamara();
    }
  }

  apagarCamara() {
    cancelAnimationFrame(this.cuadro);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.camaraActiva.set(false);
  }

  private escanear = () => {
    const v = this.video()?.nativeElement;
    if (!v || !this.camaraActiva()) return;
    if (v.readyState === v.HAVE_ENOUGH_DATA) {
      const ancho = v.videoWidth;
      const alto = v.videoHeight;
      this.lienzo.width = ancho;
      this.lienzo.height = alto;
      const ctx = this.lienzo.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(v, 0, 0, ancho, alto);
        const imagen = ctx.getImageData(0, 0, ancho, alto);
        const qr = this.jsQR(imagen.data, ancho, alto, { inversionAttempts: 'dontInvert' });
        const ahora = Date.now();
        // Evita validar el mismo QR varias veces seguidas mientras sigue frente a la cámara
        if (qr?.data && (qr.data !== this.ultimoLeido.codigo || ahora - this.ultimoLeido.momento > 4000)) {
          this.ultimoLeido = { codigo: qr.data, momento: ahora };
          this.validar(qr.data);
        }
      }
    }
    this.cuadro = requestAnimationFrame(this.escanear);
  };
}
