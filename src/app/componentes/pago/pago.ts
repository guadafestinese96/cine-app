import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ComprasService } from '../../services/compras';
import { FuncionesService } from '../../services/funciones';
import { PeliculasService } from '../../services/peliculas';
import { CuponesService } from '../../services/cupones';
import { FidelidadService } from '../../services/fidelidad';
import { ButacasService } from '../../services/butacas';
import { ConfiguracionService } from '../../services/configuracion';
import { AuthService } from '../../services/auth';
import { AvisosService } from '../../services/avisos';
import { Canje, Cupon, Funcion } from '../../core/modelos';
import { calcularEdad, clasificacionDe, edadMinima, errorLegible, formatearFuncion } from '../../core/utilidades';

export const MEDIOS_PAGO = ['Tarjeta de crédito', 'Tarjeta de débito', 'Mercado Pago'];

@Component({
  selector: 'app-pago',
  imports: [RouterLink],
  templateUrl: './pago.html',
  styleUrl: './pago.css',
})
export class PagoComponent {
  private funcionesSrv = inject(FuncionesService);
  private peliculasSrv = inject(PeliculasService);
  private cuponesSrv = inject(CuponesService);
  private fidelidad = inject(FidelidadService);
  private butacasSrv = inject(ButacasService);
  private config = inject(ConfiguracionService);
  private avisos = inject(AvisosService);
  private router = inject(Router);
  compras = inject(ComprasService);
  auth = inject(AuthService);

  readonly medios = MEDIOS_PAGO;

  cargando = signal(true);
  pagando = signal(false);
  funcion = signal<Funcion | null>(null);

  cupon = signal<Cupon | null>(null);
  cuponAutomatico = signal(false);
  codigoCupon = signal('');
  errorCupon = signal('');

  canjes = signal<Canje[]>([]);
  canjeElegido = signal<string | null>(null);
  usarCredito = signal(false);
  medio = signal(MEDIOS_PAGO[0]);

  nombre = signal('');
  email = signal('');
  declaraEdad = signal(false);

  pelicula = computed(() => this.funcion()?.peliculas);
  clasificacion = computed(() => clasificacionDe(this.pelicula()));
  minima = computed(() => edadMinima(this.clasificacion()));
  esMenor = computed(() => {
    const edad = calcularEdad(this.auth.usuarioActual()?.fecha_nacimiento);
    return edad !== null && edad < 18;
  });
  /** Si no sabemos la edad del comprador (anónimo o sin fecha), tiene que declararla */
  pideDeclaracion = computed(() => this.minima() > 0 && calcularEdad(this.auth.usuarioActual()?.fecha_nacimiento) === null);

  descripcion = computed(() => {
    const f = this.funcion();
    return f ? `${formatearFuncion(f.fecha_hora)} · ${f.salas?.nombre ?? 'Sala ' + f.sala_id} · ${f.formato} ${f.idioma}` : '';
  });

  totales = computed(() => {
    const u = this.auth.usuarioActual();
    return this.compras.calcularTotales(this.compras.enCurso(), {
      precioEstandar: this.peliculasSrv.precioEntrada(this.pelicula(), this.funcion()),
      porcentajeCupon: this.cupon()?.porcentaje ?? 0,
      usarCanjeEntrada: !!this.canjeElegido(),
      creditoDisponible: u?.credito ?? 0,
      usarCredito: this.usarCredito(),
      registrado: !!u,
    });
  });

  emailValido = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim()));

  puedePagar = computed(() => {
    if (this.pagando() || !this.compras.cantidadEntradas()) return false;
    if (!this.auth.usuarioActual() && (!this.nombre().trim() || !this.emailValido())) return false;
    if (this.pideDeclaracion() && !this.declaraEdad()) return false;
    return true;
  });

  async ngOnInit() {
    const c = this.compras.enCurso();
    if (!c.funcionId || !c.butacas.length) {
      this.cargando.set(false);
      return;
    }
    try {
      await Promise.all([this.config.cargar(), this.auth.esperarInicio()]);
      this.funcion.set(await this.funcionesSrv.obtener(c.funcionId));
      await this.butacasSrv.renovar(c.funcionId);

      const usuario = this.auth.usuarioActual();
      if (usuario) {
        const [bienvenida, canjes] = await Promise.all([
          this.cuponesSrv.bienvenidaDisponible(usuario),
          this.fidelidad.entradasGratisDisponibles(),
        ]);
        if (bienvenida) {
          this.cupon.set(bienvenida);
          this.cuponAutomatico.set(true);
        }
        this.canjes.set(canjes);
      }
    } catch (e) {
      this.avisos.error(errorLegible(e));
    } finally {
      this.cargando.set(false);
    }
  }

  async aplicarCupon() {
    this.errorCupon.set('');
    if (!this.codigoCupon().trim()) return;
    try {
      const cupon = await this.cuponesSrv.validar(this.codigoCupon(), this.auth.usuarioActual());
      this.cupon.set(cupon);
      this.cuponAutomatico.set(false);
      this.codigoCupon.set('');
      this.avisos.exito(`Cupón ${cupon.codigo} aplicado: ${cupon.porcentaje}% de descuento.`);
    } catch (e) {
      this.errorCupon.set(errorLegible(e));
    }
  }

  quitarCupon() {
    this.cupon.set(null);
    this.cuponAutomatico.set(false);
  }

  alternarCanje(codigo: string) {
    this.canjeElegido.set(this.canjeElegido() === codigo ? null : codigo);
  }

  async pagar() {
    const funcion = this.funcion();
    if (!funcion || !this.puedePagar()) return;
    this.pagando.set(true);
    try {
      const codigo = await this.compras.confirmar({
        funcion,
        totales: this.totales(),
        cuponCodigo: this.cupon()?.codigo ?? null,
        canjeCodigo: this.canjeElegido(),
        metodoPago: this.medio(),
        nombre: this.nombre().trim(),
        email: this.email().trim(),
      });
      this.router.navigate(['/ticket', codigo], { queryParams: { nueva: 1 } });
    } catch (e) {
      this.avisos.error(errorLegible(e));
      this.pagando.set(false);
    }
  }
}
