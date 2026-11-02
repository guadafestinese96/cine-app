import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase';
import { AuthService } from './auth';
import { ButacasService } from './butacas';
import { FidelidadService } from './fidelidad';
import { ActividadService } from './actividad';
import { ButacaElegida, Compra, Funcion, ItemCarrito } from '../core/modelos';
import { formatearFuncion, generarCodigo, inicioDelDia, parsearFechaLocal, sumarMinutos } from '../core/utilidades';

export interface CompraEnCurso {
  funcionId: number | null;
  butacas: ButacaElegida[];
  productos: ItemCarrito[];
  combos: ItemCarrito[];
}

export interface OpcionesTotales {
  precioEstandar: number;
  porcentajeCupon: number;
  usarCanjeEntrada: boolean;
  creditoDisponible: number;
  usarCredito: boolean;
  registrado: boolean;
}

export interface Totales {
  entradas: number;
  combos: number;
  productos: number;
  descuentoCanje: number;
  subtotal: number;
  descuentoCupon: number;
  total: number;
  creditoUsado: number;
  aPagar: number;
  puntos: number;
}

export interface ResultadoValidacion {
  valido: boolean;
  titulo: string;
  detalle: string;
  compra?: Compra;
}

const CLAVE_CARRITO = 'cinewidi_compra_en_curso';
const VACIA: CompraEnCurso = { funcionId: null, butacas: [], productos: [], combos: [] };
export const HORAS_LIMITE_CANCELACION = 2;

/**
 * Flujo de compra: butacas → candy y combos → pago → ticket con QR.
 * El carrito vive en signals y se respalda en sessionStorage para sobrevivir a un F5.
 */
@Injectable({ providedIn: 'root' })
export class ComprasService {
  private sb = inject(SupabaseService).client;
  private auth = inject(AuthService);
  private butacasSrv = inject(ButacasService);
  private fidelidad = inject(FidelidadService);
  private actividad = inject(ActividadService);

  readonly enCurso = signal<CompraEnCurso>(this.leerCarrito());
  readonly cantidadEntradas = computed(() => this.enCurso().butacas.length);
  readonly cantidadCombos = computed(() => this.enCurso().combos.reduce((t, c) => t + c.cantidad, 0));

  // ------------------------------------------------------------- Carrito

  private leerCarrito(): CompraEnCurso {
    try {
      const guardado = sessionStorage.getItem(CLAVE_CARRITO);
      return guardado ? { ...VACIA, ...JSON.parse(guardado) } : VACIA;
    } catch {
      return VACIA;
    }
  }

  private actualizar(cambio: (c: CompraEnCurso) => CompraEnCurso) {
    const nuevo = cambio(this.enCurso());
    this.enCurso.set(nuevo);
    try {
      sessionStorage.setItem(CLAVE_CARRITO, JSON.stringify(nuevo));
    } catch {
      /* sin almacenamiento: el carrito vive solo en memoria */
    }
  }

  iniciar(funcionId: number) {
    if (this.enCurso().funcionId !== funcionId) this.actualizar(() => ({ ...VACIA, funcionId }));
  }

  definirButacas(butacas: ButacaElegida[]) {
    this.actualizar((c) => ({
      ...c,
      butacas,
      // Nunca puede haber más combos que entradas
      combos: this.recortarCombos(c.combos, butacas.length),
    }));
  }

  private recortarCombos(combos: ItemCarrito[], maximo: number): ItemCarrito[] {
    let restante = maximo;
    return combos
      .map((c) => {
        const cantidad = Math.min(c.cantidad, restante);
        restante -= cantidad;
        return { ...c, cantidad };
      })
      .filter((c) => c.cantidad > 0);
  }

  cambiarCantidad(lista: 'productos' | 'combos', item: Omit<ItemCarrito, 'cantidad'>, delta: number) {
    this.actualizar((c) => {
      const items = [...c[lista]];
      const i = items.findIndex((x) => x.id === item.id);
      const actual = i >= 0 ? items[i].cantidad : 0;
      let cantidad = Math.max(0, actual + delta);
      if (lista === 'combos' && delta > 0) {
        const otrosCombos = this.cantidadCombos() - actual;
        cantidad = Math.min(cantidad, c.butacas.length - otrosCombos);
      }
      if (i >= 0) items[i] = { ...items[i], cantidad };
      else items.push({ ...item, cantidad });
      const filtrados = items.filter((x) => x.cantidad > 0);
      return lista === 'combos' ? { ...c, combos: filtrados } : { ...c, productos: filtrados };
    });
  }

  cantidadDe(lista: 'productos' | 'combos', id: number | undefined): number {
    return this.enCurso()[lista].find((x) => x.id === id)?.cantidad ?? 0;
  }

  limpiar() {
    this.actualizar(() => VACIA);
  }

  // -------------------------------------------------------------- Totales

  /**
   * Reglas de precio:
   * - Cada combo reemplaza el precio de una entrada estándar (el recargo VIP se mantiene).
   * - Un canje de "entrada gratis" descuenta una entrada estándar más.
   * - El cupón se aplica sobre el subtotal.
   * - El crédito en cuenta se descuenta del total y el resto se paga con el medio elegido.
   * - Los puntos se calculan sobre lo pagado con dinero: $1 = 1 punto.
   */
  calcularTotales(c: CompraEnCurso, o: OpcionesTotales): Totales {
    const cantidadCombos = c.combos.reduce((t, x) => t + x.cantidad, 0);
    const entradasBrutas = c.butacas.reduce((t, b) => t + Number(b.precio), 0);
    const entradas = Math.max(0, entradasBrutas - cantidadCombos * o.precioEstandar);
    const combos = c.combos.reduce((t, x) => t + x.precio * x.cantidad, 0);
    const productos = c.productos.reduce((t, x) => t + x.precio * x.cantidad, 0);
    const quedanEntradasSinCombo = c.butacas.length > cantidadCombos;
    const descuentoCanje = o.usarCanjeEntrada && quedanEntradasSinCombo ? Math.min(o.precioEstandar, entradas) : 0;
    const subtotal = entradas + combos + productos - descuentoCanje;
    const descuentoCupon = Math.round((subtotal * o.porcentajeCupon) / 100);
    const total = subtotal - descuentoCupon;
    const creditoUsado = o.usarCredito ? Math.min(o.creditoDisponible, total) : 0;
    const aPagar = total - creditoUsado;
    return {
      entradas,
      combos,
      productos,
      descuentoCanje,
      subtotal,
      descuentoCupon,
      total,
      creditoUsado,
      aPagar,
      puntos: o.registrado ? Math.floor(aPagar) : 0,
    };
  }

  // -------------------------------------------------------------- Pago

  async confirmar(params: {
    funcion: Funcion;
    totales: Totales;
    cuponCodigo: string | null;
    canjeCodigo: string | null;
    metodoPago: string;
    nombre: string;
    email: string;
  }): Promise<string> {
    const c = this.enCurso();
    const usuario = this.auth.usuarioActual();
    const codigo = generarCodigo('CW');

    // 1. Las butacas reservadas pasan a vendidas (si alguna venció, se corta acá)
    await this.butacasSrv.confirmar(params.funcion.id, c.butacas.length, codigo);

    // 2. Se registra la compra
    const compra: Compra = {
      codigo,
      usuario_id: usuario?.id ?? null,
      email: params.email || usuario?.email || null,
      nombre: params.nombre || (usuario ? `${usuario.nombre} ${usuario.apellido}` : null),
      funcion_id: params.funcion.id,
      pelicula_id: params.funcion.pelicula_id,
      butacas: c.butacas,
      productos: c.productos,
      combos: c.combos,
      cantidad_entradas: c.butacas.length,
      subtotal: params.totales.subtotal,
      descuento: params.totales.descuentoCupon,
      cupon_codigo: params.cuponCodigo,
      canje_codigo: params.totales.descuentoCanje > 0 ? params.canjeCodigo : null,
      credito_usado: params.totales.creditoUsado,
      total_pagado: params.totales.aPagar,
      metodo_pago: params.totales.aPagar > 0 ? params.metodoPago : 'Crédito en cuenta',
      puntos_ganados: params.totales.puntos,
      estado: 'pagada',
    };
    const { error } = await this.sb.from('compras').insert([compra]);
    if (error) {
      await this.butacasSrv.liberarDeCompra(codigo).catch(() => undefined);
      throw error;
    }

    // 3. Puntos ganados y crédito usado
    if (usuario && (compra.puntos_ganados || compra.credito_usado)) {
      const { data } = await this.sb.rpc('ajustar_saldo', {
        p_usuario: usuario.id,
        p_puntos: compra.puntos_ganados,
        p_credito: -compra.credito_usado,
      });
      const saldo = Array.isArray(data) ? data[0] : data;
      if (saldo) this.auth.actualizarSaldos(saldo.puntos, saldo.credito);
    }

    // 4. Canje de entrada gratis consumido
    if (compra.canje_codigo) await this.fidelidad.marcarUsado(compra.canje_codigo).catch(() => undefined);

    this.limpiar();
    return codigo;
  }

  // ------------------------------------------------------------- Consultas

  private readonly seleccion = '*, funciones(*, peliculas(*), salas(*))';

  async obtenerPorCodigo(codigo: string): Promise<Compra | null> {
    const { data, error } = await this.sb.from('compras').select(this.seleccion).eq('codigo', codigo).maybeSingle();
    if (error) throw error;
    return data as Compra | null;
  }

  async misCompras(): Promise<Compra[]> {
    const usuario = this.auth.usuarioActual();
    if (!usuario) return [];
    const { data, error } = await this.sb
      .from('compras')
      .select(this.seleccion)
      .eq('usuario_id', usuario.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Compra[];
  }

  // ---------------------------------------------------------- Cancelación

  puedeCancelar(compra: Compra): boolean {
    if (compra.estado !== 'pagada' || compra.entrada_validada_at || !compra.usuario_id) return false;
    const inicio = parsearFechaLocal(compra.funciones?.fecha_hora ?? '').getTime();
    return inicio - Date.now() >= HORAS_LIMITE_CANCELACION * 3_600_000;
  }

  /**
   * No se devuelve dinero: todo lo abonado (incluido el crédito usado) vuelve como crédito.
   * Los puntos que había dado esa compra se descuentan y el canje usado se restituye.
   */
  async cancelar(compra: Compra): Promise<number> {
    if (!this.puedeCancelar(compra)) {
      throw new Error(`Solo se puede cancelar hasta ${HORAS_LIMITE_CANCELACION} horas antes de la función.`);
    }
    const { data, error } = await this.sb
      .from('compras')
      .update({ estado: 'cancelada', cancelada_at: new Date().toISOString() })
      .eq('codigo', compra.codigo)
      .eq('estado', 'pagada')
      .select('codigo');
    if (error) throw error;
    if (!data?.length) throw new Error('La compra ya estaba cancelada.');

    await this.butacasSrv.liberarDeCompra(compra.codigo);
    const credito = Number(compra.total_pagado) + Number(compra.credito_usado);
    const { data: saldo } = await this.sb.rpc('ajustar_saldo', {
      p_usuario: compra.usuario_id,
      p_puntos: -Number(compra.puntos_ganados || 0),
      p_credito: credito,
    });
    const s = Array.isArray(saldo) ? saldo[0] : saldo;
    if (s) this.auth.actualizarSaldos(s.puntos, s.credito);

    if (compra.canje_codigo) {
      await this.sb.from('canjes').update({ usado: false, usado_at: null }).eq('codigo', compra.canje_codigo);
    }
    return credito;
  }

  // ------------------------------------------------- Validación de QR

  /**
   * Una entrada se valida una sola vez en la puerta de la sala, y el candy se entrega una sola vez.
   * Son dos sellos independientes sobre el mismo QR.
   */
  async validar(codigoLeido: string, sector: 'entrada' | 'candy'): Promise<ResultadoValidacion> {
    const codigo = codigoLeido.trim().toUpperCase();
    if (!codigo) return { valido: false, titulo: 'Código vacío', detalle: 'Escaneá el QR o escribí el código.' };

    if (codigo.startsWith('CANJE-')) return this.validarCanje(codigo, sector);

    const compra = await this.obtenerPorCodigo(codigo);
    if (!compra) return { valido: false, titulo: 'Código inexistente', detalle: `No hay ninguna compra con el código ${codigo}.` };
    if (compra.estado === 'cancelada') {
      return { valido: false, titulo: 'Compra cancelada', detalle: 'Esta compra se canceló y el QR ya no es válido.', compra };
    }

    const ahora = new Date();
    if (sector === 'entrada') {
      if (compra.entrada_validada_at) {
        return {
          valido: false,
          titulo: 'Entrada ya utilizada',
          detalle: `Se validó el ${new Date(compra.entrada_validada_at).toLocaleString('es-AR')}.`,
          compra,
        };
      }
      const inicio = parsearFechaLocal(compra.funciones?.fecha_hora ?? '');
      const fin = sumarMinutos(inicio, Number(compra.funciones?.peliculas?.duracion_minutos ?? 120));
      if (inicioDelDia(inicio).getTime() !== inicioDelDia(ahora).getTime()) {
        return { valido: false, titulo: 'No es para hoy', detalle: `La entrada es para el ${formatearFuncion(inicio)}.`, compra };
      }
      if (ahora > fin) {
        return { valido: false, titulo: 'La función terminó', detalle: `Fue el ${formatearFuncion(inicio)}.`, compra };
      }
      return this.sellar(compra, 'entrada_validada_at', 'Validó QR de entrada', 'Entrada válida');
    }

    if (!compra.productos?.length && !compra.combos?.length) {
      return { valido: false, titulo: 'Sin candy', detalle: 'Esta compra no incluye productos del candy bar.', compra };
    }
    if (compra.candy_entregado_at) {
      return {
        valido: false,
        titulo: 'Candy ya entregado',
        detalle: `Se entregó el ${new Date(compra.candy_entregado_at).toLocaleString('es-AR')}.`,
        compra,
      };
    }
    return this.sellar(compra, 'candy_entregado_at', 'Validó QR de candy bar', 'Entregar candy');
  }

  private async sellar(
    compra: Compra,
    campo: 'entrada_validada_at' | 'candy_entregado_at',
    accion: string,
    titulo: string,
  ): Promise<ResultadoValidacion> {
    const momento = new Date().toISOString();
    const cambios: Record<string, string> = {};
    cambios[campo] = momento;
    const { data, error } = await this.sb
      .from('compras')
      .update(cambios)
      .eq('codigo', compra.codigo)
      .is(campo, null)
      .select('codigo');
    if (error) throw error;
    if (!data?.length) {
      return { valido: false, titulo: 'Ya fue validado', detalle: 'Otro puesto validó este código hace instantes.', compra };
    }
    await this.actividad.registrar(accion, `${compra.codigo} · ${compra.funciones?.peliculas?.nombre ?? ''}`);
    const sellada: Compra = { ...compra };
    sellada[campo] = momento;
    return { valido: true, titulo, detalle: 'El QR quedó sellado y no se puede volver a usar para esto.', compra: sellada };
  }

  private async validarCanje(codigo: string, sector: 'entrada' | 'candy'): Promise<ResultadoValidacion> {
    const { data: canje } = await this.sb.from('canjes').select('*').eq('codigo', codigo).maybeSingle();
    if (!canje) return { valido: false, titulo: 'Canje inexistente', detalle: `No existe el canje ${codigo}.` };
    if (canje.tipo === 'entrada') {
      return { valido: false, titulo: 'Canje de entrada', detalle: 'Este canje se usa al comprar online: se descuenta en el pago.' };
    }
    if (sector !== 'candy') {
      return { valido: false, titulo: 'Canje de candy', detalle: `"${canje.nombre}" se retira en el candy bar.` };
    }
    if (canje.usado) {
      return { valido: false, titulo: 'Canje ya usado', detalle: `Se retiró el ${new Date(canje.usado_at).toLocaleString('es-AR')}.` };
    }
    await this.fidelidad.marcarUsado(codigo);
    await this.actividad.registrar('Validó canje de puntos', `${codigo} · ${canje.nombre}`);
    return { valido: true, titulo: 'Entregar canje', detalle: `${canje.nombre} (${canje.puntos} pts).` };
  }
}
