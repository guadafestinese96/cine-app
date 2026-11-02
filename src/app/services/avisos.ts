import { Injectable, signal } from '@angular/core';

export interface Aviso {
  id: number;
  texto: string;
  tipo: 'exito' | 'error' | 'info';
}

/** Mensajes flotantes (toasts) para confirmar acciones o informar errores. */
@Injectable({ providedIn: 'root' })
export class AvisosService {
  readonly avisos = signal<Aviso[]>([]);
  private siguiente = 1;

  mostrar(texto: string, tipo: Aviso['tipo'] = 'info', duracionMs = 4500) {
    const aviso = { id: this.siguiente++, texto, tipo };
    this.avisos.update((lista) => [...lista, aviso]);
    setTimeout(() => this.cerrar(aviso.id), duracionMs);
  }

  exito(texto: string) {
    this.mostrar(texto, 'exito');
  }

  error(texto: string) {
    this.mostrar(texto, 'error', 7000);
  }

  cerrar(id: number) {
    this.avisos.update((lista) => lista.filter((a) => a.id !== id));
  }
}
