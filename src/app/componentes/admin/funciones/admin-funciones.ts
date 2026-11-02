import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FuncionesService, FuncionPlanificada, PedidoProgramacion } from '../../../services/funciones';
import { PeliculasService } from '../../../services/peliculas';
import { SalaService } from '../../../services/sala';
import { ConfiguracionService } from '../../../services/configuracion';
import { AvisosService } from '../../../services/avisos';
import { AtajoFecha, CampoFechaComponent } from '../../compartidos/campo-fecha/campo-fecha';
import { FORMATOS, Funcion, IDIOMAS, Pelicula, Sala } from '../../../core/modelos';
import {
  aFechaIso, errorLegible, etiquetaDia, formatearFuncion, formatearHora, inicioDelDia, parsearFechaLocal, sumarDias,
} from '../../../core/utilidades';

const DIAS_SEMANA = [
  { n: 1, corto: 'Lun' }, { n: 2, corto: 'Mar' }, { n: 3, corto: 'Mié' }, { n: 4, corto: 'Jue' },
  { n: 5, corto: 'Vie' }, { n: 6, corto: 'Sáb' }, { n: 0, corto: 'Dom' },
];
const HORARIOS_FRECUENTES = ['13:00', '14:30', '15:30', '16:00', '17:30', '18:00', '19:00', '20:00', '20:30', '21:30', '22:00', '23:00'];

@Component({
  selector: 'app-admin-funciones',
  imports: [FormsModule, CampoFechaComponent],
  templateUrl: './admin-funciones.html',
  styles: `
    .vista-previa { margin-top: 18px; }
    .plan { list-style: none; padding: 0; margin: 12px 0; max-height: 320px; overflow-y: auto; font-size: 0.9rem; }
    .plan li { display: flex; justify-content: space-between; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--linea); }
    .plan li.problema { color: var(--error); }
    .hora-libre { display: flex; gap: 8px; margin-top: 10px; }
    .hora-libre .entrada { width: 110px; }
    .dia-titulo { margin: 22px 0 6px; font-size: 0.9rem; color: var(--bronce-claro); }
    .dia-titulo::first-letter { text-transform: uppercase; }
    .precio-funcion { width: 100px; min-height: 34px; padding: 4px 8px; }
    .hora { font-weight: 800; font-size: 1.1rem; color: var(--bronce-claro); width: 56px; }
  `,
})
export class AdminFuncionesComponent {
  private funcionesSrv = inject(FuncionesService);
  private peliculasSrv = inject(PeliculasService);
  private salaSrv = inject(SalaService);
  private avisos = inject(AvisosService);
  config = inject(ConfiguracionService);

  readonly formatos = FORMATOS;
  readonly idiomas = IDIOMAS;
  readonly diasSemana = DIAS_SEMANA;
  readonly horariosFrecuentes = HORARIOS_FRECUENTES;
  readonly atajosDesde: AtajoFecha[] = (() => {
    const hoy = inicioDelDia(new Date());
    return [
      { etiqueta: 'Hoy', fecha: hoy },
      { etiqueta: 'Mañana', fecha: sumarDias(hoy, 1) },
      { etiqueta: 'Próximo jueves', fecha: sumarDias(hoy, (4 - hoy.getDay() + 7) % 7 || 7) },
      { etiqueta: 'Próximo lunes', fecha: sumarDias(hoy, (1 - hoy.getDay() + 7) % 7 || 7) },
    ];
  })();

  peliculas = signal<Pelicula[]>([]);
  salas = signal<Sala[]>([]);
  funciones = signal<Funcion[]>([]);

  // Pedido
  peliculaId = signal<number | null>(null);
  formato = signal('2D');
  idioma = signal('Castellano');
  dias = signal<number[]>([]);
  horas = signal<string[]>([]);
  horaLibre = signal('');
  desde = aFechaIso(new Date());
  semanas = signal(1);
  salaFija = signal<number | null>(null);
  precio: number | null = null;

  plan = signal<FuncionPlanificada[]>([]);
  guardando = signal(false);
  filtroPelicula = signal<number | null>(null);

  pelicula = computed(() => this.peliculas().find((p) => p.id === this.peliculaId()) ?? null);
  validas = computed(() => this.plan().filter((p) => !p.problema).length);

  proximas = computed(() => {
    const ahora = Date.now();
    const grupos = new Map<string, { etiqueta: string; funciones: Funcion[] }>();
    for (const f of this.funciones()) {
      const fecha = parsearFechaLocal(f.fecha_hora);
      if (fecha.getTime() < ahora) continue;
      if (this.filtroPelicula() && Number(f.pelicula_id) !== this.filtroPelicula()) continue;
      const clave = aFechaIso(fecha);
      if (!grupos.has(clave)) grupos.set(clave, { etiqueta: etiquetaDia(fecha), funciones: [] });
      grupos.get(clave)!.funciones.push(f);
    }
    return [...grupos.values()].slice(0, 21);
  });

  constructor() {
    this.cargar();
  }

  async cargar() {
    try {
      await this.config.cargar();
      const [peliculas, salas, funciones] = await Promise.all([
        this.peliculasSrv.listar(true),
        this.salaSrv.listar(false),
        this.funcionesSrv.listar(),
      ]);
      this.peliculas.set(peliculas.filter((p) => p.activa !== false));
      this.salas.set(salas);
      this.funciones.set(funciones);
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }

  alternarDia(n: number) {
    this.dias.update((d) => (d.includes(n) ? d.filter((x) => x !== n) : [...d, n]));
    this.plan.set([]);
  }

  diasAtajo(tipo: 'todos' | 'semana' | 'finde') {
    this.dias.set(tipo === 'todos' ? [0, 1, 2, 3, 4, 5, 6] : tipo === 'semana' ? [1, 2, 3, 4, 5] : [5, 6, 0]);
    this.plan.set([]);
  }

  alternarHora(h: string) {
    this.horas.update((l) => (l.includes(h) ? l.filter((x) => x !== h) : [...l, h].sort()));
    this.plan.set([]);
  }

  /** Acepta "1830", "18:30" o "18.30" */
  agregarHoraLibre() {
    const limpio = this.horaLibre().replace(/\D/g, '').padStart(4, '0').slice(-4);
    const hh = Number(limpio.slice(0, 2));
    const mm = Number(limpio.slice(2));
    if (hh > 23 || mm > 59 || !this.horaLibre().trim()) {
      this.avisos.error('Escribí la hora como 18:30.');
      return;
    }
    const hora = `${limpio.slice(0, 2)}:${limpio.slice(2)}`;
    if (!this.horas().includes(hora)) this.alternarHora(hora);
    this.horaLibre.set('');
  }

  armarPedido(): PedidoProgramacion | null {
    const pelicula = this.pelicula();
    if (!pelicula || !this.dias().length || !this.horas().length || !this.desde) return null;
    return {
      pelicula,
      dias: this.dias(),
      horas: this.horas(),
      desde: parsearFechaLocal(this.desde),
      semanas: this.semanas(),
      formato: this.formato(),
      idioma: this.idioma(),
      precioBase: this.precio ? Number(this.precio) : null,
      salaFija: this.salaFija(),
    };
  }

  previsualizar() {
    const pedido = this.armarPedido();
    if (!pedido) {
      this.avisos.error('Elegí película, al menos un día, un horario y la fecha de inicio.');
      return;
    }
    const duraciones = new Map<number, number>(this.peliculas().map((p) => [p.id, p.duracion_minutos] as [number, number]));
    this.plan.set(this.funcionesSrv.planificar(pedido, this.funciones(), this.salas(), duraciones));
  }

  async confirmar() {
    const pedido = this.armarPedido();
    if (!pedido) return;
    this.guardando.set(true);
    try {
      // Se recalcula con datos frescos por si otro admin programó algo mientras tanto
      this.funciones.set(await this.funcionesSrv.listar());
      this.previsualizar();
      const creadas = await this.funcionesSrv.crear(pedido, this.plan());
      this.avisos.exito(`Se programaron ${creadas} funciones de "${pedido.pelicula.nombre}".`);
      this.plan.set([]);
      this.funciones.set(await this.funcionesSrv.listar());
    } catch (e) {
      this.avisos.error(errorLegible(e));
    } finally {
      this.guardando.set(false);
    }
  }

  textoPlan(p: FuncionPlanificada) {
    return `${formatearFuncion(p.inicio)} → termina ${formatearHora(p.fin)}`;
  }

  hora(f: Funcion) {
    return formatearHora(parsearFechaLocal(f.fecha_hora));
  }

  async guardarPrecio(f: Funcion, valor: string) {
    const precio = valor ? Number(valor) : null;
    if (precio === (f.precio_base ?? null)) return;
    try {
      await this.funcionesSrv.cambiarPrecio(f, precio);
      f.precio_base = precio;
      this.avisos.exito('Precio actualizado.');
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }

  async eliminar(f: Funcion) {
    try {
      await this.funcionesSrv.eliminar(f);
      this.funciones.update((l) => l.filter((x) => x.id !== f.id));
      this.avisos.exito('Función eliminada.');
    } catch (e) {
      this.avisos.error(errorLegible(e));
    }
  }
}
