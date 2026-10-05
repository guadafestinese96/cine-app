# 🎬 CineWidi - Sistema de Gestión de Cine & Entradas

**CineWidi** es una aplicación desarrollada en **Angular** y **Supabase** para la gestión integral de un complejo de cines. El proyecto permite a los usuarios consultar cartelera, comprar entradas con selección de asientos en tiempo real, adquirir productos del Candy Bar, acumular puntos de fidelización, cancelar reservas y acceder a paneles diferenciados según su rol (Cliente / Administrador).

Proyecto desarrollado para la **Tecnicatura Universitaria en Programación (UTN FRA)**.

---

## 🚀 Características Principales

### 👤 Autenticación y Control de Acceso
* **Login y Registro de Usuarios:** Manejo de estado global de sesión mediante **Angular Signals** y `AuthService`.
* **Protección de Rutas (Guards):**
  * `authGuard`: Restringe el acceso a `/perfil` a usuarios no autenticados.
  * `adminGuard`: Restringe la ruta `/admin` exclusivamente a usuarios con rol `admin`, redirigiendo a los clientes a `/catalogo`.
* **Persistencia:** Mantenimiento de sesión y preferencias del usuario mediante `localStorage`.

### 🎟️ Cartelera, Reservas y Tickets
* **Cartelera Dinámica:** Filtro de películas por nombre y género.
* **Preventa Exclusiva:** Sección destacada para películas con venta anticipada de entradas.
* **Selección de Butacas:** Interfaz interactiva de sala para elección de asientos.
* **Generación de Ticket PDF con QR:** Emisión de comprobantes digitales de compra con código QR para validación.

### 🍿 Candy Bar & Descuentos
* **Tienda de Combos:** Selección y agregado de alimentos/bebidas al carrito.
* **Cupones de Descuento:** Soporte para descuentos de bienvenida (20%) y beneficios por rango de edad (ej. `MAYOR50`).

### ⭐ Programa de Fidelización (RF-24)
* **Acumulación de Puntos:** $1 gastado = 1 punto acumulado automáticamente.
* **Canje de Premios:** Panel en la vista de perfil para canjear puntos acumulados por productos del Candy Bar o entradas gratis.
* **Historial de Canjes:** Registro detallado con código de cupón, puntos consumidos y fecha.

### 💵 Cancelación de Reservas y Crédito (RF-19)
* **Reembolso a Saldo en Cuenta:** Permite cancelar funciones con hasta 2 horas de anticipación.
* El monto reembolsado se acredita en la cuenta del usuario para futuras compras.


## 🛠️ Tecnologías Utilizadas

* **Frontend:** Angular (Standalone Components, Signals, Router, Guards)
* **Estilos:** CSS3 / Flexbox / FontAwesome
* **Backend / Base de Datos:** Supabase
* **PWA:** `@angular/service-worker` & Web App Manifest
* **Librerías Adicionales:** `jspdf` / `qrcode` / `rxjs`

---

## 📁 Estructura del Proyecto

```text
src/
├── app/
│   ├── componentes/
│   │   ├── admin/           # Panel de administración de películas y funciones
│   │   ├── candy/           # Menú y compra de Candy Bar
│   │   ├── catalogo/        # Cartelera, buscador, preventa y top más vendidas
│   │   ├── login/           # Formulario de inicio de sesión
│   │   ├── navbar/          # Navegación y menú desplegable de usuario
│   │   ├── perfil/          # Panel personal, crédito, fidelización y reseñas
│   │   ├── registro/        # Registro de nuevos usuarios
│   │   ├── sala/            # Selección de butacas e interactividad
│   │   └── ticket/          # Resumen de compra, generación de QR y PDF
│   ├── guards/
│   │   ├── admin.guard.ts   # Control de acceso solo admin
│   │   └── auth.guard.ts    # Control de acceso a usuarios logueados
│   ├── services/
│   │   ├── auth.ts          # Servicio de autenticación con Signals
│   │   └── peliculas.ts     # Servicio de datos de películas y funciones
│   ├── app.routes.ts        # Definición de rutas de la aplicación
│   └── app.config.ts        # Configuración principal y Service Worker PWA
├── manifest.webmanifest     # Archivo de configuración PWA
└── ngsw-config.json         # Configuración del Service Worker de Angular