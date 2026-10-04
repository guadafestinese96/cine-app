import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PeliculasService } from '../../services/peliculas';

interface Butaca {
  fila: string;
  numero: number;
  tipo: 'estandar' | 'adaptada' | 'vip';
  bloque: 'izquierdo' | 'centro' | 'derecho';
  ocupada: boolean;
  seleccionada: boolean;
  precio: number;
}

@Component({
  selector: 'app-sala',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sala.html',
  styleUrl: './sala.css'
})
export class SalaComponent implements OnInit {
  filas = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];
  
  mapaButacas: Butaca[] = [];
  butacasSeleccionadas: Butaca[] = [];
  
  precioBase = 5000;
  precioVip = 6500;
  funcionSeleccionada: any = null;
  funcionId: number = 1;
  mensajeErrorEdad = '';

  constructor(
    private peliculasService: PeliculasService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.obtenerFuncionSeleccionada();
    this.generarMapaBase();
    await this.consultarButacasOcupadas();
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
    this.mapaButacas = [];

    for (const fila of this.filas) {
      const esAdaptada = (fila === 'J' || fila === 'K');
      const esVip = (fila === 'R' || fila === 'S' || fila === 'T');
      
      const cantIzq = esAdaptada ? 2 : 4;
      const cantCentro = esAdaptada ? 10 : 20;
      const cantDer = esAdaptada ? 2 : 4;

      let numeroActual = 1;

      for (let i = 0; i < cantIzq; i++) {
        this.crearButaca(fila, numeroActual++, esAdaptada, esVip, 'izquierdo');
      }
      for (let i = 0; i < cantCentro; i++) {
        this.crearButaca(fila, numeroActual++, esAdaptada, esVip, 'centro');
      }
      for (let i = 0; i < cantDer; i++) {
        this.crearButaca(fila, numeroActual++, esAdaptada, esVip, 'derecho');
      }
    }
  }

  private crearButaca(fila: string, numero: number, esAdaptada: boolean, esVip: boolean, bloque: 'izquierdo' | 'centro' | 'derecho') {
    let tipo: 'estandar' | 'adaptada' | 'vip' = 'estandar';
    let precio = this.precioBase;

    if (esAdaptada) {
      tipo = 'adaptada';
    } else if (esVip) {
      tipo = 'vip';
      precio = this.precioVip;
    }

    this.mapaButacas.push({
      fila,
      numero,
      tipo,
      bloque,
      ocupada: false,
      seleccionada: false,
      precio
    });
  }

  async consultarButacasOcupadas() {
    try {
      const ocupadas = await this.peliculasService.obtenerButacasOcupadas(this.funcionId);
      
      if (ocupadas && ocupadas.length > 0) {
        this.mapaButacas.forEach(b => {
          const estaOcupada = ocupadas.some((o: any) => o.fila === b.fila && Number(o.numero) === b.numero);
          if (estaOcupada) {
            b.ocupada = true;
          }
        });
        this.cdr.detectChanges();
      }
    } catch (e) {
      console.warn('Error o sin reservas cargadas para esta función:', e);
    }
  }

  getButacasBloque(fila: string, bloque: 'izquierdo' | 'centro' | 'derecho'): Butaca[] {
    return this.mapaButacas.filter(b => b.fila === fila && b.bloque === bloque);
  }

  toggleSeleccion(b: Butaca) {
    if (b.ocupada) return;
    b.seleccionada = !b.seleccionada;
    this.butacasSeleccionadas = this.mapaButacas.filter(item => item.seleccionada);
    this.validarRestriccionEdad();
  }

  get totalPagar(): number {
    return this.butacasSeleccionadas.reduce((sum, b) => sum + b.precio, 0);
  }

  get tieneButacasVip(): boolean {
    return this.butacasSeleccionadas.some(b => b.tipo === 'vip');
  }

  // Comprueba la restricción de edad sin usar alerts
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
        this.mensajeErrorEdad = '⛔ Esta película es para mayores de 18 años. Según tu fecha de nacimiento no cumples con la edad mínima requerida.';
        return false;
      }
      if (clasificacion === '+13' && edad < 13) {
        this.mensajeErrorEdad = '⛔ Esta película es para mayores de 13 años. Según tu fecha de nacimiento no cumples con la edad mínima requerida.';
        return false;
      }
    } catch (e) {
      console.error('Error al validar fecha de nacimiento:', e);
    }

    return true;
  }

  async confirmarReserva() {
    if (this.butacasSeleccionadas.length === 0) return;

    if (!this.validarRestriccionEdad()) return;

    // Guardar selección para el paso del Candy Bar y Pago
    localStorage.setItem('butacas_seleccionadas', JSON.stringify(this.butacasSeleccionadas));
    localStorage.setItem('total_entradas', this.totalPagar.toString());

    this.router.navigate(['/candy']);
  }
}