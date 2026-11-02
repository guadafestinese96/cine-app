# CineWidi · Resumen de requerimientos

Relevamiento de todos los pedidos del cliente ("Empresario Importante") en el intercambio de mails del 01/01/2020 al 10/03/2020, ordenados por área. Cada requerimiento indica dónde quedó resuelto en la aplicación.

Referencias: **RF** = requerimiento funcional, **RNF** = requerimiento no funcional.

## 1. Cartelera y películas

| Código | Requerimiento | Origen | Dónde se resuelve |
|---|---|---|---|
| RF-01 | Toda película tiene nombre, duración, imagen y sinopsis. | 01/01 | Admin → Películas |
| RF-02 | El admin elige qué películas aparecen en la página (visible / oculta). | 01/01 | Admin → Películas (interruptor Visible/Oculta) |
| RF-03 | Cada película puede tener **varios géneros**. | 16/01 | Admin → Películas (fichas de género múltiples) |
| RF-04 | En la página principal se muestran **primero las 3 películas más vendidas**. | 16/01 | Cartelera → marquesina "Las más vistas" |
| RF-05 | El listado tiene **buscador** por nombre y **filtro por género**. | 16/01 | Cartelera → buscador + fichas de género |
| RF-06 | Restricción de edad: ATP, +13 y +18. Los menores no pueden comprar y toda entrada de una película restringida aclara que debe ir un adulto. | 12/02 | Sala (bloqueo por edad), Pago (declaración si no se conoce la edad), Ticket/PDF (leyenda) |
| RF-07 | Sección **Próximamente** con estrenos de las próximas semanas y alerta para avisar cuando salgan las entradas. | 08/03 | Cartelera → Próximamente + "Avisarme" + notificación al iniciar sesión |
| RF-08 | **Preventa** configurable por película: se abre 7 días antes del estreno con precio especial; después vuelve el precio normal. | 08/03 | Admin → Películas (preventa + precio), regla en `PeliculasService.estadoVenta()` |

## 2. Funciones y salas

| Código | Requerimiento | Origen | Dónde se resuelve |
|---|---|---|---|
| RF-09 | Un edificio con varias salas. Todas iguales: 20 filas (A–T) y tres columnas de 4, 20 y 4 butacas. | 01/01 | `SalaService.generarPlano()` |
| RF-10 | Las filas J y K pasan a ser butacas para personas con discapacidad: 2, 10 y 2 por columna, resaltadas visualmente. | 12/02 | Plano de butacas (color turquesa + ícono) |
| RF-11 | Las filas R, S y T son **VIP**, más caras, marcadas distinto; el usuario sabe que compra VIP antes de pagar. | 10/03 | Plano (violeta con borde bronce), resumen y pago muestran "VIP" y el precio |
| RF-12 | Cada función define horario, formato (2D, 3D, 4D, 5D) e idioma (castellano o subtitulada). | 01/01 | Admin → Funciones |
| RF-13 | No puede haber una función antes de que pasen **30 minutos** del fin de la anterior en la misma sala. | 01/01 | `FuncionesService.planificar()` |
| RF-14 | **Asignación automática de sala**: el admin indica días y horario (ej. lunes, martes y viernes 18 h) y el sistema elige una sala libre; nunca dos funciones en la misma sala al mismo tiempo. | 06/02 | Admin → Funciones (programación recurrente con vista previa) |
| RF-15 | El admin controla salas, funciones y distribución de butacas. | 06/02 | Admin → Salas (alta, activar/desactivar, butacas fuera de servicio) |

## 3. Compra de entradas

| Código | Requerimiento | Origen | Dónde se resuelve |
|---|---|---|---|
| RF-16 | Se puede comprar **sin registrarse**. | 01/01 | Pago (nombre y mail para anónimos) |
| RF-17 | Las butacas se ven **en tiempo real**: quien elige ve cuáles ocupa otra compra en ese momento. | 12/02 | Supabase Realtime + reserva temporal de 10 minutos |
| RF-18 | Se genera un **PDF** con los datos de la entrada y un **QR**. | 01/01 | Ticket → Descargar PDF |
| RF-19 | El candy bar se compra junto con la entrada y se retira **con el mismo QR**. | 30/01 | Paso "Candy bar" de la compra |
| RF-20 | **Combos** (entrada + pochoclos + bebida) a precio fijo configurable, destacados en la compra. | 03/03 | Admin → Candy y combos; paso Candy bar |
| RF-21 | Cancelar una compra **hasta 2 horas antes**; no se devuelve dinero sino **crédito** en la cuenta, usable junto con otros medios de pago. | 10/03 | Mi cuenta → Cancelar compra; Pago → "Usar mi crédito" |

## 4. Usuarios, cupones y fidelización

| Código | Requerimiento | Origen | Dónde se resuelve |
|---|---|---|---|
| RF-22 | Registro con mail, nombre, apellido, fecha de nacimiento, tipo de sangre, color de ojos y días de vacaciones por año. | 01/01 | Crear cuenta |
| RF-23 | Beneficio de registro: cupón en la **primera compra**, con **porcentaje configurable** (20 % por defecto). | 01/01, 30/01 | Se aplica solo en Pago; Admin → Precios y beneficios |
| RF-24 | Cupones solo para **usuarios de más de 50 años**. | 30/01 | Cupones tipo "mayores_50" |
| RF-25 | Programa de puntos: **1 punto por peso** gastado (usuarios registrados). | 03/03 | Pago → `ComprasService.calcularTotales()` |
| RF-26 | Canje de puntos por entradas o productos; el admin define cuántos puntos cuesta cada recompensa. Los puntos **no se transfieren**. | 03/03 | Mi cuenta → Puntos y canjes; Admin → Precios y beneficios |
| RF-27 | El perfil muestra puntos acumulados e **historial de canjes**. | 03/03 | Mi cuenta → Puntos y canjes |
| RF-28 | **Reseñas**: estrellas + comentario corto por película, visibles antes de comprar, con **puntaje promedio**. | 16/01 | Detalle de película |
| RF-29 | **Mis películas**: historial visual con pósters, fechas y calificación propia. | 08/03 | Mi cuenta → Mis películas |

## 5. Empleados y administración

| Código | Requerimiento | Origen | Dónde se resuelve |
|---|---|---|---|
| RF-30 | Usuario **administrador** que controla salas, funciones, butacas, productos, etc. | 06/02 | Rol `admin` + `/admin` |
| RF-31 | Usuarios **empleados** que escanean QRs para la sala y para el candy bar. | 06/02 | Rol `empleado` + `/validar` (cámara) |
| RF-32 | Se puede **ingresar el código a mano** si el lector no funciona. | 06/02 | `/validar` → campo manual |
| RF-33 | Una vez validada la entrada o entregada la comida, **el QR deja de funcionar** para eso. | 06/02 | `ComprasService.validar()` (sellos `entrada_validada_at` y `candy_entregado_at`) |
| RF-34 | Productos del candy con **categorías**. | 30/01 | Admin → Candy y combos |
| RF-35 | **Reporte** de facturación por día y entradas vendidas, exportable a **PDF y Excel**. | 28/02, 10/03 | Admin → Reportes |
| RF-36 | **Gráficos** de películas más vistas por semana y por mes, y del producto más vendido del candy. | 10/03 | Admin → Reportes |
| RF-37 | **Log de actividad**: quién creó una función, modificó un precio o validó un QR, con fecha y hora. | 10/03 | Admin → Actividad |

## 6. No funcionales

| Código | Requerimiento | Origen | Cómo se cumple |
|---|---|---|---|
| RNF-01 | Interfaces fáciles de navegar para clientes y empleados. | 28/02 | Flujo de compra en 3 pasos con indicador, validador con resultado grande verde/rojo |
| RNF-02 | Mejor forma de ingresar fechas y horas, sin calendarios que obligan a navegar ni tanto scroll. | 28/02 | Fecha tipeada en 3 casillas con atajos ("Este jueves"), horarios como fichas de un toque |
| RNF-03 | Estilo visual único y producido. | Consigna | Sistema visual "sala de terciopelo": bordó, bronce de marquesina y entradas de papel troqueladas |
| RNF-04 | Angular con buenas prácticas. | Consigna | Standalone components, signals, zoneless, lazy loading, guards funcionales, servicios por dominio |
| RNF-05 | Integración con Supabase. | Consigna | Auth, base de datos, funciones SQL atómicas y Realtime |
| RNF-06 | PWA. | Consigna | Service worker, manifest, íconos, caché de cartelera |
| RNF-07 | Aplicación desplegada, código en GitHub y README con arquitectura. | Consigna | `vercel.json` / `_redirects`, README |

## 7. Pendiente sin aprobación del cliente

- **Mapa del cine** indicando la sala de la entrada (30/01): el cliente aclaró que "no tenemos luz verde aún", por lo que no se implementó.
