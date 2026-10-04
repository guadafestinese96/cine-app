import { Injectable } from '@angular/core';

export interface Funcion {
  id?: number;
  sala_id: number;
  pelicula_id: number;
  fecha_inicio: string; // ISO String o Date
  duracion_minutos: number;
}

@Injectable({
  providedIn: 'root'
})
export class SalaService {
  // Ejemplo de salas disponibles
  salas = [
    { id: 1, nombre: 'Sala 1' },
    { id: 2, nombre: 'Sala 2' },
    { id: 3, nombre: 'Sala 3' }
  ];

  // Supongamos que traés las funciones ya agendadas de la base de datos / Supabase
  funcionesExistentes: Funcion[] = [];

  obtenerSalaDisponible(fechaInicioDeseada: Date, duracionPeliculaMinutos: number): number | null {
    const finFuncionDeseada = new Date(fechaInicioDeseada.getTime() + (duracionPeliculaMinutos + 30) * 60000);

    for (const sala of this.salas) {
      const tieneSuperposicion = this.funcionesExistentes.some(funcion => {
        if (funcion.sala_id !== sala.id) return false;

        const inicioExistente = new Date(funcion.fecha_inicio);
        // Inicio + duración + 30 minutos de limpieza obligatorios
        const finExistente = new Date(inicioExistente.getTime() + (funcion.duracion_minutos + 30) * 60000);

        // Comprobación de solapamiento de rangos de tiempo
        return (fechaInicioDeseada < finExistente && finFuncionDeseada > inicioExistente);
      });

      if (!tieneSuperposicion) {
        return sala.id; // Retorna la primera sala libre disponible
      }
    }

    return null; // Si ninguna sala tiene espacio con los 30 min de margen
  }
}