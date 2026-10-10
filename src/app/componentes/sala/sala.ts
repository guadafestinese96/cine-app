import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PeliculasService } from '../../services/peliculas';
import { Subscription } from 'rxjs';

interface Butaca {
  fila: string;
  numero: number;
  tipo: 'estandar' | 'adaptada' | 'vip';
  bloque: 'izquierdo' | 'centro' | 'derecho';
  ocupada: boolean;
  seleccionada: boolean;
  precio: number;
  reservadaPorOtro?: boolean;
  esHueco?: boolean; // Para rellenar invisiblemente las filas adaptadas
}

interface FilaEstructurada {
  letra: string;
  izquierdo: Butaca[];
  centro: Butaca[];
  derecho: Butaca[];
}

@Component({
  selector: 'app-sala',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sala.html',
  styleUrl: './sala.css'
})
export class SalaComponent implements OnInit, OnDestroy {
  // 20 Filas completas según requerimiento de la consigna
  filas = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];
  
  filasEstructuradas: FilaEstructurada[] = [];
  butacasSeleccionadas: Butaca[] = [];
  
  precioBase = 5000;
  precioVip = 6500;
  funcionSeleccionada: any = null;
  funcionId: number = 1;
  mensajeErrorEdad = '';
  
  sessionId: string = '';
  usuarioEmail: string = '';

  private realtimeSub!: Subscription;

  constructor(
    private peliculasService: PeliculasService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.obtenerDatosSesion();
    this.obtenerFuncionSeleccionada();
    this.generarMapaBase();
    await this.consultarButacasOcupadas();
    this.iniciarSuscripcionRealtime();
  }

  ngOnDestroy(): void {
    if (this.realtimeSub) {
      this.realtimeSub.unsubscribe();
    }
    this.peliculasService.desconectarRealtime();
  }

  obtenerDatosSesion() {
    this.sessionId = sessionStorage.getItem('cine_session_id') || 'sess-anonima';

    const usuarioStorage = localStorage.getItem('usuario_logueado');
    if (usuarioStorage) {
      try {
        const u = JSON.parse(usuarioStorage);
        this.usuarioEmail = (u.email || '').toLowerCase().trim();
      } catch (e) {
        this.usuarioEmail = '';
      }
    }
  }

  obtenerFuncionSeleccionada() {
    const funcionGuardada = localStorage.getItem('funcion_seleccionada');
    if (funcionGuardada) {
      this.funcionSeleccionada = JSON.parse(funcionGuardada);
      this.funcionId = this.funcionSeleccionada.id;
      if (this.funcionSeleccionada.precio_base) {
        this.precioBase = Number(this.funcionSeleccionada.precio_base);
      }
    }
    this.precioVip = Math.round(this.precioBase * 1.3);
  }

  generarMapaBase() {
    this.filasEstructuradas = [];

    for (const fila of this.filas) {
      const esAdaptada = (fila === 'J' || fila === 'K');
      const esVip = (fila === 'R' || fila === 'S' || fila === 'T');

      const bloqueIzq: Butaca[] = [];
      const bloqueCentro: Butaca[] = [];
      const bloqueDer: Butaca[] = [];

      if (esAdaptada) {
        // Filas J y K (Adaptadas): 2 izq + 2 huecos, 5 huecos + 10 adaptadas + 5 huecos, 2 huecos + 2 der
        bloqueIzq.push(this.crearButaca(fila, 1, esAdaptada, esVip, 'izquierdo'));
        bloqueIzq.push(this.crearButaca(fila, 2, esAdaptada, esVip, 'izquierdo'));
        bloqueIzq.push(this.crearHueco(fila, 'izquierdo'));
        bloqueIzq.push(this.crearHueco(fila, 'izquierdo'));

        for (let i = 5; i <= 9; i++) {
          bloqueCentro.push(this.crearHueco(fila, 'centro'));
        }
        for (let i = 10; i <= 19; i++) {
          bloqueCentro.push(this.crearButaca(fila, i, esAdaptada, esVip, 'centro'));
        }
        for (let i = 20; i <= 24; i++) {
          bloqueCentro.push(this.crearHueco(fila, 'centro'));
        }

        bloqueDer.push(this.crearHueco(fila, 'derecho'));
        bloqueDer.push(this.crearHueco(fila, 'derecho'));
        bloqueDer.push(this.crearButaca(fila, 27, esAdaptada, esVip, 'derecho'));
        bloqueDer.push(this.crearButaca(fila, 28, esAdaptada, esVip, 'derecho'));
      } else {
        // Filas normales (4, 20 y 4)
        for (let i = 1; i <= 4; i++) {
          bloqueIzq.push(this.crearButaca(fila, i, esAdaptada, esVip, 'izquierdo'));
        }
        for (let i = 5; i <= 24; i++) {
          bloqueCentro.push(this.crearButaca(fila, i, esAdaptada, esVip, 'centro'));
        }
        for (let i = 25; i <= 28; i++) {
          bloqueDer.push(this.crearButaca(fila, i, esAdaptada, esVip, 'derecho'));
        }
      }

      this.filasEstructuradas.push({
        letra: fila,
        izquierdo: bloqueIzq,
        centro: bloqueCentro,
        derecho: bloqueDer
      });
    }
  }

  private crearHueco(fila: string, bloque: 'izquierdo' | 'centro' | 'derecho'): Butaca {
    return {
      fila,
      numero: 0,
      tipo: 'estandar',
      bloque,
      ocupada: false,
      seleccionada: false,
      precio: 0,
      esHueco: true
    };
  }

  private crearButaca(
    fila: string, 
    numero: number, 
    esAdaptada: boolean, 
    esVip: boolean, 
    bloque: 'izquierdo' | 'centro' | 'derecho'
  ): Butaca {
    let tipo: 'estandar' | 'adaptada' | 'vip' = 'estandar';
    let precio = this.precioBase;

    if (esAdaptada) {
      tipo = 'adaptada';
    } else if (esVip) {
      tipo = 'vip';
      precio = this.precioVip;
    }

    const estaSeleccionadaPrev = this.butacasSeleccionadas.some(s => s.fila === fila && s.numero === numero);

    return {
      fila,
      numero,
      tipo,
      bloque,
      ocupada: false,
      seleccionada: estaSeleccionadaPrev,
      precio,
      esHueco: false
    };
  }

  async consultarButacasOcupadas() {
    try {
      const ocupadas = await this.peliculasService.obtenerButacasOcupadas(this.funcionId);
      this.butacasSeleccionadas = [];

      if (ocupadas && ocupadas.length > 0) {
        this.filasEstructuradas.forEach(f => {
          [...f.izquierdo, ...f.centro, ...f.derecho].forEach(b => {
            if (b.esHueco) return;

            const reserva = ocupadas.find((o: any) => o.fila === b.fila && Number(o.numero) === b.numero);
            if (reserva) {
              if (reserva.session_id === this.sessionId) {
                b.seleccionada = true;
                if (!this.butacasSeleccionadas.some(s => s.fila === b.fila && s.numero === b.numero)) {
                  this.butacasSeleccionadas.push(b);
                }
              } else {
                b.ocupada = true;
                b.reservadaPorOtro = true;
              }
            }
          });
        });
      }
      this.cdr.detectChanges();
    } catch (e) {
      console.warn('Sin reservas previas:', e);
    }
  }

  iniciarSuscripcionRealtime() {
    this.realtimeSub = this.peliculasService
      .escucharButacasRealtime(this.funcionId)
      .subscribe((payload) => {
        const eventType = payload.eventType;
        const reg = payload.new || payload.old;

        if (!reg || reg.session_id === this.sessionId) return;

        this.filasEstructuradas.forEach(f => {
          [...f.izquierdo, ...f.centro, ...f.derecho].forEach(b => {
            if (b.esHueco) return;

            if (b.fila === reg.fila && b.numero === Number(reg.numero)) {
              if (eventType === 'INSERT') {
                b.ocupada = true;
                b.seleccionada = false;
                b.reservadaPorOtro = true;
              } else if (eventType === 'DELETE') {
                b.ocupada = false;
                b.reservadaPorOtro = false;
              }
            }
          });
        });

        this.recalcularButacasSeleccionadas();
        this.cdr.detectChanges();
      });
  }

  async toggleSeleccion(b: Butaca) {
    if (b.ocupada || b.esHueco) return;

    const estabaSeleccionada = b.seleccionada;

    try {
      if (!estabaSeleccionada) {
        b.seleccionada = true;
        await this.peliculasService.ocuparButaca(
          this.funcionId, 
          b.fila, 
          b.numero, 
          this.sessionId,
          this.usuarioEmail
        );
      } else {
        b.seleccionada = false;
        await this.peliculasService.liberarButaca(
          this.funcionId, 
          b.fila, 
          b.numero, 
          this.sessionId
        );
      }
    } catch (e) {
      console.error('Error al seleccionar butaca:', e);
      b.seleccionada = estabaSeleccionada;
      alert('Esta butaca fue seleccionada por otro usuario recientemente.');
    }

    this.recalcularButacasSeleccionadas();
    this.validarRestriccionEdad();
    this.cdr.detectChanges();
  }

  private recalcularButacasSeleccionadas() {
    this.butacasSeleccionadas = [];
    for (const f of this.filasEstructuradas) {
      const todas = [...f.izquierdo, ...f.centro, ...f.derecho];
      for (const item of todas) {
        if (item.seleccionada && !item.esHueco) {
          this.butacasSeleccionadas.push(item);
        }
      }
    }
  }

  get totalPagar(): number {
    return this.butacasSeleccionadas.reduce((sum, b) => sum + b.precio, 0);
  }

  private validarRestriccionEdad(): boolean {
    this.mensajeErrorEdad = '';
    const pelicula = this.funcionSeleccionada?.peliculas;
    const clasificacion = pelicula?.clasificacion || pelicula?.restriccion_edad;

    if (!clasificacion || clasificacion === 'ATP') return true;

    const usuarioStorage = localStorage.getItem('usuario_logueado');
    if (!usuarioStorage) return true;

    try {
      const usuario = JSON.parse(usuarioStorage);
      if (!usuario.fecha_nacimiento) return true;

      const hoy = new Date();
      const nac = new Date(usuario.fecha_nacimiento);
      let edad = hoy.getFullYear() - nac.getFullYear();
      const m = hoy.getMonth() - nac.getMonth();
      if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) {
        edad--;
      }

      if (clasificacion === '+18' && edad < 18) {
        this.mensajeErrorEdad = '⛔ Esta película es para mayores de 18 años. Tu edad no cumple el requisito.';
        return false;
      }
      if (clasificacion === '+13' && edad < 13) {
        this.mensajeErrorEdad = '⛔ Esta película es para mayores de 13 años. Tu edad no cumple el requisito.';
        return false;
      }
    } catch (e) {
      console.error('Error edad:', e);
    }

    return true;
  }

  async confirmarReserva() {
    if (this.butacasSeleccionadas.length === 0 || !this.validarRestriccionEdad()) return;

    localStorage.setItem('butacas_seleccionadas', JSON.stringify(this.butacasSeleccionadas));
    localStorage.setItem('total_entradas', this.totalPagar.toString());

    this.router.navigate(['/candy']);
  }
}