# Finly

Sistema de generación y gestión de facturas profesional construido con Angular 18 y Express.js. Permite registrar tareas trabajadas por día, generar facturas con diseño personalizable y exportarlas en PDF.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Angular 18 (standalone) + Tailwind CSS v3 |
| Backend | Express.js + TypeScript |
| Base de datos | PostgreSQL |
| Autenticación | JWT (jsonwebtoken + bcryptjs) |
| Generación PDF | Puppeteer (HTML → PDF) |
| Upload de archivos | Multer |

---

## Estructura del Proyecto

```
invoice-generator/
├── api/                          # Backend Express + TypeScript
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts       # Pool de conexión PostgreSQL
│   │   │   └── migrate.ts        # Script de migraciones (crea tablas)
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts     # Verificación JWT
│   │   │   └── upload.middleware.ts   # Multer (logos y firmas)
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── invoices.routes.ts
│   │   │   ├── clients.routes.ts
│   │   │   └── profile.routes.ts
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── invoices.controller.ts
│   │   │   ├── clients.controller.ts
│   │   │   └── profile.controller.ts
│   │   ├── services/
│   │   │   └── pdf.service.ts    # Generación de PDF con Puppeteer
│   │   └── index.ts              # Entry point
│   ├── uploads/
│   │   ├── logos/                # Logos subidos por el usuario
│   │   └── signatures/           # Firmas subidas por el usuario
│   ├── .env                      # Variables de entorno
│   ├── package.json
│   └── tsconfig.json
│
├── ui/                           # Frontend Angular 18
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/
│   │   │   │   ├── models/
│   │   │   │   │   └── index.ts          # Interfaces TypeScript
│   │   │   │   ├── services/
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── invoice.service.ts
│   │   │   │   │   ├── client.service.ts
│   │   │   │   │   ├── profile.service.ts
│   │   │   │   │   └── toast.service.ts
│   │   │   │   ├── guards/
│   │   │   │   │   └── auth.guard.ts     # authGuard + guestGuard
│   │   │   │   └── interceptors/
│   │   │   │       └── auth.interceptor.ts  # Agrega Bearer token
│   │   │   ├── layout/
│   │   │   │   ├── shell/                # Contenedor principal (sidebar + outlet)
│   │   │   │   └── sidebar/              # Navegación lateral
│   │   │   ├── features/
│   │   │   │   ├── auth/login/           # Login + Registro
│   │   │   │   ├── dashboard/            # Estadísticas y facturas recientes
│   │   │   │   ├── invoices/
│   │   │   │   │   ├── invoice-list/     # Listado con filtros y búsqueda
│   │   │   │   │   ├── invoice-editor/   # Formulario de creación/edición
│   │   │   │   │   └── invoice-preview/  # Vista previa idéntica al PDF
│   │   │   │   ├── clients/              # Gestión de clientes (modal CRUD)
│   │   │   │   └── settings/             # Perfil, pagos, logo y firma
│   │   │   ├── app.config.ts
│   │   │   ├── app.routes.ts
│   │   │   └── app.component.ts          # Root + sistema de toasts
│   │   ├── environments/
│   │   │   └── environment.ts
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── styles.css                    # Tailwind + componentes globales
│   ├── angular.json
│   ├── tailwind.config.js
│   └── package.json
│
└── README.md
```

---

## Requisitos Previos

- **Node.js** v18 o superior
- **npm** v9 o superior
- **PostgreSQL** accesible en la red local
- ~150 MB de espacio adicional para que Puppeteer descargue Chromium (solo la primera vez)

---

## Configuración de Base de Datos

Las credenciales están en [api/.env](api/.env):

```env
DB_HOST=192.168.1.3
DB_PORT=5432
DB_NAME=invoice_generator_db
DB_USER=nesticle8bit
DB_PASSWORD=<password>
```

La base de datos **debe existir** antes de ejecutar las migraciones. Si no existe, créala manualmente:

```sql
CREATE DATABASE invoice_generator_db;
```

---

## Instalación y Puesta en Marcha

### 1. Backend (API)

```bash
cd api
npm install
```

Ejecutar migraciones (crea todas las tablas):

```bash
npm run migrate
```

Iniciar en modo desarrollo:

```bash
npm run dev
```

La API quedará disponible en `http://localhost:3000`

---

### 2. Frontend (UI)

```bash
cd ui
npm install
npm start
```

La aplicación quedará disponible en `http://localhost:4200`

> **Primera vez con Puppeteer:** al generar el primer PDF, se descargará Chromium automáticamente. Esto solo ocurre una vez y puede tardar unos minutos dependiendo de la conexión.

---

## Primer Uso

1. Abrir `http://localhost:4200`
2. Ir a la pestaña **Register** y crear tu cuenta
3. Navegar a **Settings** y completar:
   - **Personal**: nombre, VAT/NIT, teléfono
   - **Payment**: SWIFT/BIC, IBAN, tarifa por hora por defecto
   - **Logo & Signature**: subir logo (PNG recomendado con fondo transparente) y firma
4. Ir a **Clients** y agregar tu cliente (ej. GmbH)
5. Ir a **Invoices → New Invoice** y crear tu primera factura

---

## Endpoints de la API

### Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Registrar usuario |
| `POST` | `/api/auth/login` | Iniciar sesión |
| `GET` | `/api/auth/me` | Obtener usuario actual |

### Facturas
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/invoices` | Listar facturas (con filtros) |
| `POST` | `/api/invoices` | Crear factura |
| `GET` | `/api/invoices/:id` | Obtener factura por ID |
| `PUT` | `/api/invoices/:id` | Actualizar factura |
| `DELETE` | `/api/invoices/:id` | Eliminar factura |
| `GET` | `/api/invoices/:id/pdf` | Descargar PDF |
| `GET` | `/api/invoices/stats` | Estadísticas del dashboard |
| `GET` | `/api/invoices/next-number` | Siguiente número de factura |

### Clientes
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/clients` | Listar clientes |
| `POST` | `/api/clients` | Crear cliente |
| `GET` | `/api/clients/:id` | Obtener cliente |
| `PUT` | `/api/clients/:id` | Actualizar cliente |
| `DELETE` | `/api/clients/:id` | Eliminar cliente |

### Perfil
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/profile` | Obtener perfil y settings |
| `PUT` | `/api/profile` | Actualizar perfil |
| `POST` | `/api/profile/logo` | Subir logo (`multipart/form-data`, campo: `logo`) |
| `POST` | `/api/profile/signature` | Subir firma (`multipart/form-data`, campo: `signature`) |

> Todos los endpoints excepto `/api/auth/register` y `/api/auth/login` requieren el header:
> `Authorization: Bearer <token>`

---

## Esquema de la Base de Datos

```sql
users          -- Credenciales de acceso
profiles       -- Información personal, bancaria, rutas de logo y firma
clients        -- Empresas a las que se les factura
invoices       -- Cabecera de cada factura
invoice_items  -- Líneas de tareas (descripción, horas, tarifa, importe)
```

### Relaciones
```
users ──< profiles       (1:1)
users ──< clients        (1:N)
users ──< invoices       (1:N)
clients ──< invoices     (1:N)
invoices ──< invoice_items (1:N)
```

---

## Funcionalidades

### Dashboard
- Contador de facturas totales, pagadas, enviadas y borradores
- Ingresos totales e ingresos del mes actual
- Últimas 5 facturas con acceso directo

### Facturas
- Número automático con padding de 4 dígitos (`0075`, `0076`...)
- Estados: `draft` → `sent` → `paid`
- Items dinámicos: descripción, horas, tarifa, importe calculado
- Periodo de trabajo (fecha inicio/fin para las notas)
- Vista previa en pantalla idéntica al PDF generado
- Descarga de PDF generado por Puppeteer en el servidor

### Clientes
- CRUD completo con modal
- Campos: nombre, dirección, ciudad, código postal, país, VAT, email

### Settings
- **Personal**: nombre, VAT/NIT, teléfono
- **Payment**: SWIFT/BIC, IBAN, banco, tarifa/hora por defecto, moneda
- **Logo & Signature**: upload con previsualización inmediata

### Diseño del PDF
El PDF generado replica exactamente la estructura de las facturas existentes:
- Logo o iniciales (arriba izquierda)
- Datos personales (arriba derecha)
- Bill To + N° de factura / Fecha
- Tabla de tareas con totales
- Total resaltado
- SWIFT/BIC e IBAN
- Notas
- Firma

---

## Scripts Disponibles

### API
```bash
npm run dev      # Desarrollo con hot-reload (ts-node-dev)
npm run build    # Compilar TypeScript a dist/
npm run start    # Ejecutar build compilado
npm run migrate  # Crear/actualizar tablas en PostgreSQL
```

### UI
```bash
npm start        # ng serve --port 4200
npm run build    # Compilar para producción
npm run watch    # Build en modo watch (desarrollo)
```

---

## Variables de Entorno (API)

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `PORT` | Puerto del servidor | `3000` |
| `NODE_ENV` | Entorno | `development` |
| `DB_HOST` | Host PostgreSQL | `192.168.1.3` |
| `DB_PORT` | Puerto PostgreSQL | `5432` |
| `DB_NAME` | Nombre de la base de datos | `invoice_generator_db` |
| `DB_USER` | Usuario PostgreSQL | `nesticle8bit` |
| `DB_PASSWORD` | Contraseña PostgreSQL | — |
| `JWT_SECRET` | Clave secreta para firmar tokens | — |
| `JWT_EXPIRES_IN` | Expiración del token | `7d` |
| `UPLOAD_DIR` | Directorio de uploads | `uploads` |
| `MAX_FILE_SIZE` | Tamaño máximo de archivo (bytes) | `5242880` (5MB) |
