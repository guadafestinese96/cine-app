import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CuponesService {

  validarYAplicarCupon(codigo: string, usuario: any, primeraCompra: boolean = false): { valido: boolean; porcentaje: number; mensaje: string } {
    const code = codigo.trim().toUpperCase();

    // RF-14: Cupón de bienvenida (20% por defecto)
    if (code === 'BIENVENIDA' || code === 'BIENVENIDA20') {
      if (!primeraCompra) {
        return { valido: false, porcentaje: 0, mensaje: 'El cupón de bienvenida es válido únicamente para tu primera compra.' };
      }
      return { valido: true, porcentaje: 20, mensaje: '¡Cupón de bienvenida del 20% aplicado!' };
    }

    // RF-15: Cupón segmentado para mayores de 50 años
    if (code === 'MAYOR50' || code === 'SENIOR50') {
      if (!usuario || !usuario.fecha_nacimiento) {
        return { valido: false, porcentaje: 0, mensaje: 'Debes tener la fecha de nacimiento registrada para usar este cupón.' };
      }

      const edad = this.calcularEdad(usuario.fecha_nacimiento);
      if (edad < 50) {
        return { valido: false, porcentaje: 0, mensaje: 'Este cupón exclusivo es válido únicamente para usuarios mayores de 50 años.' };
      }

      return { valido: true, porcentaje: 25, mensaje: '¡Cupón Senior aplicado con éxito!' };
    }

    return { valido: false, porcentaje: 0, mensaje: 'El código de cupón ingresado no es válido.' };
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
}