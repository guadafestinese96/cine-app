import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';
import { ActividadService } from './actividad';
import { Cupon, Usuario } from '../core/modelos';
import { calcularEdad } from '../core/utilidades';

/**
 * Cupones configurables:
 * - bienvenida: se aplica solo en la primera compra de un usuario registrado (el % lo define el admin).
 * - mayores_50: solo para usuarios con más de 50 años.
 * - general: cualquiera con cuenta.
 */
@Injectable({ providedIn: 'root' })
export class CuponesService {
  private sb = inject(SupabaseService).client;
  private actividad = inject(ActividadService);

  async listar(): Promise<Cupon[]> {
    const { data, error } = await this.sb.from('cupones').select('*').order('id');
    if (error) throw error;
    return (data ?? []).map((c) => ({ ...c, porcentaje: Number(c.porcentaje) }));
  }

  async guardar(cupon: Cupon) {
    const datos = {
      codigo: cupon.codigo.trim().toUpperCase(),
      descripcion: cupon.descripcion ?? '',
      porcentaje: Number(cupon.porcentaje),
      tipo: cupon.tipo,
      activo: cupon.activo,
    };
    if (cupon.id) {
      const { data: anterior } = await this.sb.from('cupones').select('porcentaje').eq('id', cupon.id).maybeSingle();
      const { error } = await this.sb.from('cupones').update(datos).eq('id', cupon.id);
      if (error) throw error;
      const cambio = anterior && Number(anterior.porcentaje) !== datos.porcentaje ? ` (${anterior.porcentaje}% → ${datos.porcentaje}%)` : '';
      await this.actividad.registrar('Editó cupón', `${datos.codigo}${cambio}`);
    } else {
      const { error } = await this.sb.from('cupones').insert([datos]);
      if (error) throw new Error(error.code === '23505' ? 'Ya existe un cupón con ese código.' : error.message);
      await this.actividad.registrar('Creó cupón', `${datos.codigo} ${datos.porcentaje}% (${datos.tipo})`);
    }
  }

  async esPrimeraCompra(usuarioId: string): Promise<boolean> {
    const { count } = await this.sb
      .from('compras')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', usuarioId);
    return !count;
  }

  /** Cupón de bienvenida que le corresponde automáticamente al usuario, si todavía no compró. */
  async bienvenidaDisponible(usuario: Usuario | null): Promise<Cupon | null> {
    if (!usuario) return null;
    const { data } = await this.sb.from('cupones').select('*').eq('tipo', 'bienvenida').eq('activo', true).limit(1);
    const cupon = data?.[0];
    if (!cupon) return null;
    return (await this.esPrimeraCompra(usuario.id)) ? { ...cupon, porcentaje: Number(cupon.porcentaje) } : null;
  }

  async validar(codigo: string, usuario: Usuario | null): Promise<Cupon> {
    const limpio = codigo.trim().toUpperCase();
    if (!usuario) throw new Error('Los cupones son un beneficio para usuarios registrados. Iniciá sesión para usarlos.');

    const { data } = await this.sb.from('cupones').select('*').eq('codigo', limpio).maybeSingle();
    if (!data || !data.activo) throw new Error(`El cupón ${limpio} no existe o ya no está vigente.`);
    const cupon: Cupon = { ...data, porcentaje: Number(data.porcentaje) };

    if (cupon.tipo === 'mayores_50') {
      const edad = calcularEdad(usuario.fecha_nacimiento);
      if (edad === null) throw new Error('Para este cupón necesitamos tu fecha de nacimiento. Cargala en tu perfil.');
      if (edad <= 50) throw new Error('Este cupón es para personas de más de 50 años.');
    }
    if (cupon.tipo === 'bienvenida' && !(await this.esPrimeraCompra(usuario.id))) {
      throw new Error('El cupón de bienvenida es solo para tu primera compra.');
    }
    return cupon;
  }
}
