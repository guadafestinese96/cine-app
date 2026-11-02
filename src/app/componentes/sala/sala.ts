import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FuncionesService } from '../../services/funciones';
import { PeliculasService } from '../../services/peliculas';
import { ButacasService } from '../../services/butacas';
import { ComprasService } from '../../services/compras';
import { ConfiguracionService } from '../../services/configuracion';
import { AuthService } from '../../services/auth';
import { AvisosService } from '../../services/avisos';
import { Asiento, SalaService } from '../../services/sala';
import { MapaButacasComponent } from '../compartidos/mapa-butacas/mapa-butacas';
import { ButacaElegida, Funcion } from '../../core/modelos';
import { calcularEdad, clasificacionDe, dos, edadMinima, errorLegible, formatearFuncion, parsearFechaLocal } from '../../core/utilidades';

export const MAXIMO_BUTACAS = 10;

@Component({
  selector: 'app-sala',
  imports: [RouterLink, MapaButacasComponent],
  templateUrl: './sala.html',
  styleUrl: './sala.css',
})
export class SalaComponent {
  private funcionesSrv = inject(FuncionesService);
  private peliculasSrv = inject(PeliculasService);
  private butacasSrv = inject(ButacasService);
  private compras = inject(ComprasService);
  private config = inject(ConfiguracionService);
  private auth = inject(AuthService);
  private avisos = inject(AvisosService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  salaSrv = inject(SalaService);

  funcionId = input.required<string>();

  cargando = signal(true);
  funcion = signal<Funcion | null>(null);
  mias = signal<Set<string>>(new Set());
  ocupadas = signal<Set<string>>(new Set());
  vencimiento = signal<Date | null>(null);
  ahora = signal(Date.now());
  procesando = signal(false);
  bloqueo = signal('');

  readonly maximo = MAXIMO_BUTACAS;

  pelicula = computed(() => this.funcion()?.peliculas);
  clasificacion = computed(() => clasificacionDe(this.pelicula()));
  restriccion = computed(() => edadMinima(this.clasificacion()));
  esMenor = computed(() => {
    const edad = calcularEdad(this.auth.usuarioActual()?.fecha_nacimiento);
    return edad !== null && edad < 18;
  });
  bloqueadas = computed(() => this.funcion()?.salas?.butacas_bloqueadas ?? []);
  precioEstandar = computed(() => this.peliculasSrv.precioEntrada(this.pelicula(), this.funcion()));
  precioVip = computed(() => this.config.precioVip(this.precioEstandar()));
  descripcionFuncion = computed(() => {
    const f = this.funcion();
    return f ? `${formatearFuncion(f.fecha_hora)} · ${f.salas?.nombre ?? 'Sala ' + f.sala_id} · ${f.formato} ${f.idioma}` : '';
  });

  elegidas = computed<ButacaElegida[]>(() => {
    const ids = this.mias();
    return this.salaSrv.plano
      .flatMap((f) => f.bloques.flat())
      .filter((a): a is Asiento => !!a && ids.has(a.id))
      .map((a) => ({ fila: a.fila, numero: a.numero, tipo: a.tipo, precio: a.tipo === 'vip' ? this.precioVip() : this.precioEstandar() }));
  });
  total = computed(() => this.elegidas().reduce((t, b) => t + b.precio, 0));
  hayVip = computed(() => this.elegidas().some((b) => b.tipo === 'vip'));

  restante = computed(() => {
    const v = this.vencimiento();
    if (!v || !this.mias().size) return '';
    const seg = Math.max(0, Math.floor((v.getTime() - this.ahora()) / 1000));
    return `${Math.floor(seg / 60)}:${dos(seg % 60)}`;
  });

  async ngOnInit() {
    const id = Number(this.funcionId());
    try {
      await this.config.cargar();
      const funcion = await this.funcionesSrv.obtener(id);
      if (!funcion || !funcion.peliculas) {
        this.bloqueo.set('Esa función no existe.');
        return;
      }
      this.funcion.set(funcion);
      this.compras.iniciar(id);

      if (parsearFechaLocal(funcion.fecha_hora).getTime() <= Date.now()) {
        this.bloqueo.set('Esta función ya comenzó. Elegí otro horario.');
        return;
      }
      if (!this.peliculasSrv.estaEnVenta(funcion.peliculas)) {
        this.bloqueo.set('Las entradas para esta película todavía no están a la venta.');
        return;
      }
      const minima = edadMinima(clasificacionDe(funcion.peliculas));
      const edad = calcularEdad(this.auth.usuarioActual()?.fecha_nacimiento);
      if (minima && edad !== null && edad < minima) {
        this.bloqueo.set(`"${funcion.peliculas.nombre}" es para mayores de ${minima} años. Con tu cuenta no se pueden comprar entradas para esta película.`);
        return;
      }

      if (this.esMenor()) {
        this.avisos.mostrar('Como sos menor de edad, para ver la película tenés que ir acompañado/a de un adulto.', 'info', 9000);
      }

      await this.refrescar();
      const desuscribir = this.butacasSrv.escuchar(id, () => this.refrescar());
      const reloj = setInterval(() => {
        this.ahora.set(Date.now());
        const v = this.vencimiento();
        if (v && this.mias().size && v.getTime() <= Date.now()) this.refrescar();
      }, 1000);
      this.destroyRef.onDestroy(() => {
        desuscribir();
        clearInterval(reloj);
      });
    } catch (e) {
      this.bloqueo.set(errorLegible(e));
    } finally {
      this.cargando.set(false);
    }
  }

  private refrescando = false;
  async refrescar() {
    if (this.refrescando) return;
    this.refrescando = true;
    try {
      const estado = await this.butacasSrv.estado(Number(this.funcionId()));
      this.mias.set(estado.mias);
      this.ocupadas.set(estado.ocupadas);
      this.vencimiento.set(estado.vencimiento);
    } finally {
      this.refrescando = false;
    }
  }

  async tocar(a: Asiento) {
    const id = Number(this.funcionId());
    const mias = new Set(this.mias());
    this.procesando.set(true);
    try {
      if (mias.has(a.id)) {
        mias.delete(a.id);
        this.mias.set(mias);
        await this.butacasSrv.liberar(id, a);
      } else {
        if (mias.size >= MAXIMO_BUTACAS) {
          this.avisos.mostrar(`Podés elegir hasta ${MAXIMO_BUTACAS} butacas por compra.`);
          return;
        }
        mias.add(a.id);
        this.mias.set(mias);
        await this.butacasSrv.reservar(id, a, this.auth.usuarioActual()?.email);
      }
    } catch (e) {
      this.avisos.error(errorLegible(e));
    } finally {
      this.procesando.set(false);
      await this.refrescar();
    }
  }

  async soltarTodas() {
    await this.butacasSrv.liberarTodas(Number(this.funcionId()));
    await this.refrescar();
  }

  async continuar() {
    if (!this.elegidas().length) return;
    this.procesando.set(true);
    try {
      await this.butacasSrv.renovar(Number(this.funcionId()));
      this.compras.definirButacas(this.elegidas());
      this.router.navigate(['/candy']);
    } finally {
      this.procesando.set(false);
    }
  }
}
