import { Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

/**
 * Si la imagen no carga (URL rota, vacía o que bloquea el uso desde otro sitio),
 * la reemplaza por un póster generado con el nombre, en lugar del ícono de imagen rota.
 * Uso: <img [src]="p.imagen_url" [respaldo]="p.nombre" />
 */
@Directive({
  selector: 'img[respaldo]',
  host: { '(error)': 'usarRespaldo()' },
})
export class ImagenRespaldoDirective {
  respaldo = input('');

  private img: HTMLImageElement = inject(ElementRef).nativeElement;
  private aplicado = false;

  constructor() {
    // Algunos navegadores no disparan "error" con una URL vacía, así que se revisa al dibujar
    afterNextRender(() => {
      if (!this.img.getAttribute('src')?.trim()) this.usarRespaldo();
    });
  }

  usarRespaldo() {
    if (this.aplicado) return;
    this.aplicado = true;
    this.img.src = posterGenerado(this.respaldo());
  }
}

function posterGenerado(titulo: string): string {
  const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Corta el título en renglones de ~14 caracteres
  const renglones: string[] = [];
  for (const palabra of (titulo || 'CineWidi').toUpperCase().split(/\s+/)) {
    const ultimo = renglones[renglones.length - 1];
    if (ultimo && (ultimo + ' ' + palabra).length <= 14) renglones[renglones.length - 1] = ultimo + ' ' + palabra;
    else renglones.push(palabra);
  }
  const visibles = renglones.slice(0, 5);
  const inicio = 190 - (visibles.length - 1) * 13;
  const texto = visibles
    .map((r, i) => `<text x="100" y="${inicio + i * 26}" text-anchor="middle">${escapar(r)}</text>`)
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b1a2c"/><stop offset="1" stop-color="#2b0810"/></linearGradient></defs>
    <rect width="200" height="300" fill="url(#g)"/>
    <rect x="8" y="8" width="184" height="284" rx="6" fill="none" stroke="#d4a64a" stroke-opacity=".45"/>
    <g fill="#f0ce7e" opacity=".85">
      <circle cx="100" cy="90" r="38" fill="none" stroke="#d4a64a" stroke-width="4"/>
      <circle cx="100" cy="70" r="9"/><circle cx="100" cy="110" r="9"/><circle cx="80" cy="90" r="9"/><circle cx="120" cy="90" r="9"/>
    </g>
    <g fill="#f3e9d2" font-family="Georgia, serif" font-size="19" font-weight="700">${texto}</g>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
