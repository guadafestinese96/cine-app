# CineWidi

Sistema de venta de entradas y candy bar para un complejo de cines. Hecho con **Angular 22** y **Supabase** como trabajo práctico 1 de Programación IV (UTN FRA).

- Resumen de requerimientos del cliente: [`docs/REQUERIMIENTOS.md`](docs/REQUERIMIENTOS.md)
- Migración de base de datos: [`supabase/migracion_tp.sql`](supabase/migracion_tp.sql)

## Puesta en marcha

```bash
npm install
npm start            # http://localhost:4200
npm run build        # genera dist/cine-app/browser (con service worker)
```

### Base de datos

1. En Supabase → **SQL Editor** → pegar y ejecutar `supabase/migracion_tp.sql`. Es idempotente: agrega columnas y tablas nuevas sin borrar datos.
2. Crear las cuentas desde la app ("Crear cuenta") y darles rol:
   ```sql
   update usuarios set rol = 'admin'    where email = 'admin@cineapp.com';
   update usuarios set rol = 'empleado' where email = 'empleado@cineapp.com';
   ```
   Después, el admin puede cambiar roles desde **Administración → Usuarios**.
3. Si Supabase pide confirmar el mail al registrarse, se puede desactivar en *Authentication → Providers → Email → Confirm email* para probar más rápido.

### Despliegue

- **Vercel**: importar el repositorio; `vercel.json` ya define el build y la reescritura de rutas al `index.html`.
- **Netlify**: build `npm run build`, carpeta `dist/cine-app/browser`; `public/_redirects` resuelve las rutas.

La cámara del validador de QR y el service worker requieren **HTTPS** (o `localhost`).

## Arquitectura

```
src/app/
├── core/
│   ├── modelos.ts          Interfaces del dominio (Pelicula, Funcion, Compra, Cupon…)
│   └── utilidades.ts       Fechas "hora de pared", edad, formato de precios, códigos
├── services/               Un servicio por dominio, todos providedIn: 'root'
│   ├── supabase.ts         Cliente único de Supabase
│   ├── auth.ts             Sesión y perfil con signals (rol, puntos, crédito)
│   ├── peliculas.ts        Películas, reglas de venta/preventa, reseñas, alertas
│   ├── funciones.ts        Funciones y asignación automática de salas
│   ├── sala.ts             Plano de butacas y salas
│   ├── butacas.ts          Reservas temporales en tiempo real
│   ├── compras.ts          Carrito, cálculo de totales, pago, cancelación, validación de QR
│   ├── candy.ts            Productos y combos
│   ├── cupones.ts          Cupones de bienvenida, mayores de 50 y generales
│   ├── fidelidad.ts        Recompensas y canjes de puntos
│   ├── reportes.ts         Facturación, rankings y exportación PDF/Excel
│   ├── tickets.ts          QR y PDF de la entrada
│   ├── actividad.ts        Log de actividad
│   ├── configuracion.ts    Precio general, recargo VIP, minutos de reserva
│   ├── notificaciones.ts   Avisos de "Próximamente"
│   ├── usuarios.ts         Roles (admin)
│   └── avisos.ts           Toasts
├── guards/                 authGuard, adminGuard, empleadoGuard, sessionGuard
└── componentes/
    ├── catalogo/           Marquesina top 3, cartelera con buscador, próximamente
    ├── detalle-pelicula/   Info, reseñas y horarios
    ├── sala/ → candy/ → pago/ → ticket/     Flujo de compra
    ├── perfil/             Mis entradas, Mis películas, Puntos y canjes
    ├── validar/            Escáner de QR para empleados
    ├── admin/              Panel con una subcarpeta por pestaña
    └── compartidos/        mapa-butacas, campo-fecha, estrellas, avisos
```

### Flujo de una compra

```
Cartelera → Película → Sala (butacas en vivo) → Candy bar (combos + productos) → Pago → Ticket con QR
                         │ reserva 10 min          │                               │
                         └─ butacas_ocupadas ──────┴── compras (pagada) ───────────┴── QR = código de compra
```

## Decisiones técnicas (para la defensa)

**Angular moderno.** Componentes standalone, `signal`/`computed` para todo el estado, detección de cambios *zoneless*, nuevo control de flujo (`@if`, `@for`, `@switch`), `input()` enlazado a parámetros de ruta (`withComponentInputBinding`), guards funcionales asíncronos y lazy loading de todas las rutas salvo la cartelera. Formularios reactivos donde hay validación (login, registro, admin) y un `ControlValueAccessor` propio para la fecha.

**Servicios por dominio.** Los componentes no hablan con Supabase: llaman a servicios que encapsulan las consultas y las reglas de negocio. Eso deja la lógica en un solo lugar (por ejemplo, el precio de una entrada se calcula siempre en `PeliculasService.precioEntrada()`).

**Butacas en tiempo real sin doble venta.** Al tocar una butaca se inserta en `butacas_ocupadas` como `reservada` con vencimiento (10 minutos, configurable). Un índice único `(funcion_id, fila, numero)` hace que dos personas no puedan tomar la misma butaca: la segunda recibe un error. Todos los navegadores escuchan cambios por **Supabase Realtime** y recargan el estado. Al pagar, las reservas pasan a `vendida`; si alguien abandona, la reserva vence sola. Cada pestaña se identifica con un `session_id` (sirve también para compras anónimas).

**Asignación automática de salas.** `FuncionesService.planificar()` genera todas las fechas pedidas (días de la semana × horarios × semanas) y, para cada una, busca la primera sala activa donde no se superponga con otra función considerando **duración + 30 minutos** de limpieza en ambos sentidos. También tiene en cuenta las funciones que va asignando en el mismo lote. Muestra una vista previa antes de guardar y se recalcula con datos frescos al confirmar.

**Fechas sin sorpresas de zona horaria.** Las funciones se guardan como "hora de pared" (`2026-11-02T18:00:00`) y se leen ignorando cualquier sufijo de zona. Así, 18:00 es 18:00 en cualquier navegador.

**Reglas de precio** (`ComprasService.calcularTotales`):
- Entrada general/accesible: precio de la función o el general. VIP: + recargo configurable (30 %).
- Preventa: precio especial mientras la película no se estrenó.
- Cada combo reemplaza el precio de una entrada general (el recargo VIP se mantiene); no puede haber más combos que entradas.
- Canje de "entrada gratis": descuenta una entrada general.
- Cupón: porcentaje sobre el subtotal (uno por compra).
- Crédito en cuenta: se descuenta del total y el resto se paga con el medio elegido.
- Puntos: 1 por cada peso pagado con dinero (no por el crédito usado).

**Cancelación.** Hasta 2 horas antes y si la entrada no se usó. Todo lo abonado (dinero + crédito usado) vuelve como crédito; se descuentan los puntos que había dado esa compra y se libera el canje usado. Las butacas quedan libres.

**QR de un solo uso por sector.** El QR contiene el código de compra. Hay dos sellos independientes: `entrada_validada_at` (puerta) y `candy_entregado_at` (candy bar). La validación hace un `update … where campo is null`: si dos puestos escanean a la vez, solo uno gana. También rechaza compras canceladas, entradas de otro día y funciones terminadas. Los canjes de candy (`CANJE-…`) se validan en el mismo lugar.

**Operaciones atómicas en SQL.** Sumar/restar puntos y crédito (`ajustar_saldo`) y canjear recompensas (`canjear_recompensa`) son funciones de Postgres llamadas con `supabase.rpc`, para que el saldo nunca quede negativo aunque haya dos pedidos simultáneos.

**Edad.** Con cuenta, se calcula desde la fecha de nacimiento y se bloquea la compra si no alcanza. Sin cuenta (o sin fecha), el comprador declara la edad. Toda entrada de una película +13/+18 lleva la leyenda de adulto acompañante, en pantalla y en el PDF.

**Ingreso de fechas (pedido del 28/02).** En lugar del calendario desplegable que obliga a navegar mes a mes, la fecha se tipea en tres casillas que avanzan solas (DD → MM → AAAA) y tiene atajos de un toque ("Este jueves", "Mañana"). Los horarios de funciones son fichas con los horarios habituales más un campo libre.

**PWA.** `@angular/service-worker` con prefetch de la app, caché de fuentes e imágenes y una estrategia *freshness* para la cartelera (si no hay conexión se muestra la última versión). Manifest con íconos 192/512 y `maskable`.

**Diseño.** Sistema visual propio: terciopelo bordó de butaca, bronce de marquesina (con lamparitas en el top 3) y las compras como **entradas de papel troqueladas**. Tipografías Limelight (títulos, estilo art déco de cine) y Manrope (texto). Responsive hasta 360 px, foco visible y `prefers-reduced-motion` respetado.

**Seguridad (alcance del TP).** Toda la lógica corre en el cliente con la clave pública, por eso las políticas RLS de la migración son abiertas. En un sistema real, el pago, la validación de QR y los cambios de rol irían en funciones del servidor (Edge Functions) con políticas por `auth.uid()` y rol.

## Usuarios de prueba sugeridos

| Rol | Qué puede hacer |
|---|---|
| Cliente | Comprar, cancelar, reseñar, canjear puntos |
| Empleado | Validar QRs (`/validar`) |
| Admin | Todo el panel `/admin` y también validar |
