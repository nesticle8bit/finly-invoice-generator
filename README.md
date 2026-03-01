# Finly — Invoice Generator

A full-stack invoice management system built with Angular 18 and Express.js. Track daily tasks, generate professional invoices, export them as PDFs, and share them with collaborators for Work Package entry — all without requiring them to create an account.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 18 (standalone) + Tailwind CSS v3 |
| Backend | Express.js + TypeScript |
| Database | PostgreSQL |
| Authentication | JWT (jsonwebtoken + bcryptjs) |
| PDF Generation | Puppeteer (HTML → PDF) |
| File Uploads | Multer |
| Containerization | Docker + Docker Compose |

---

## Project Structure

```
invoice-generator/
├── docker-compose.yml
├── .env.example
├── api/                          # Express + TypeScript backend
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts       # PostgreSQL connection pool
│   │   │   └── migrate.ts        # Migration script (creates tables)
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   └── upload.middleware.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── invoices.routes.ts
│   │   │   ├── clients.routes.ts
│   │   │   ├── profile.routes.ts
│   │   │   └── share.routes.ts
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── invoices.controller.ts
│   │   │   ├── clients.controller.ts
│   │   │   ├── profile.controller.ts
│   │   │   └── share.controller.ts
│   │   ├── services/
│   │   │   └── pdf.service.ts    # Puppeteer PDF generation
│   │   └── index.ts
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
└── ui/                           # Angular 18 frontend
    ├── src/
    │   ├── app/
    │   │   ├── core/
    │   │   │   ├── models/index.ts
    │   │   │   ├── services/
    │   │   │   │   ├── auth.service.ts
    │   │   │   │   ├── invoice.service.ts
    │   │   │   │   ├── client.service.ts
    │   │   │   │   ├── profile.service.ts
    │   │   │   │   ├── share.service.ts
    │   │   │   │   └── toast.service.ts
    │   │   │   ├── guards/auth.guard.ts
    │   │   │   └── interceptors/auth.interceptor.ts
    │   │   ├── layout/
    │   │   │   ├── shell/
    │   │   │   └── sidebar/
    │   │   └── features/
    │   │       ├── auth/login/
    │   │       ├── dashboard/
    │   │       ├── invoices/
    │   │       │   ├── invoice-list/
    │   │       │   ├── invoice-editor/
    │   │       │   └── invoice-preview/
    │   │       ├── clients/
    │   │       ├── settings/
    │   │       └── share/          # Public WP entry page (no login required)
    │   └── environments/
    │       ├── environment.ts      # Development
    │       └── environment.prod.ts # Production (relative URLs for Docker)
    ├── nginx.conf
    ├── Dockerfile
    ├── angular.json
    ├── tailwind.config.js
    └── package.json
```

---

## Prerequisites

- **Node.js** v18+
- **npm** v9+
- **PostgreSQL** accessible on the network
- **Docker + Docker Compose** (for production deployment)

---

## Local Development

### 1. API

```bash
cd api
npm install
```

Create `api/.env`:

```env
PORT=3000
DB_HOST=your_postgres_host
DB_PORT=5432
DB_NAME=invoice_generator
DB_USER=your_user
DB_PASSWORD=your_password
JWT_SECRET=a_long_random_secret
UPLOAD_DIR=uploads
```

Run migrations (creates all tables):

```bash
npm run migrate
```

Start in dev mode:

```bash
npm run dev
# API available at http://localhost:3000
```

### 2. UI

```bash
cd ui
npm install
npm start
# App available at http://localhost:4200
```

---

## Production Deployment (Docker)

### Architecture

```
Internet → :80 (nginx)
             ├── /          → Angular static files
             ├── /api/*     → proxy → api:3000
             └── /uploads/* → proxy → api:3000
```

nginx acts as a reverse proxy, so both the app and the API are served on the same origin — no CORS issues.

### Setup

**1. Install Docker on your Ubuntu server**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
```

**2. Copy the project to the server**
```bash
scp -r ./invoice-generator user@your-server-ip:~/invoice-generator
```

**3. Create the `.env` file**
```bash
cd ~/invoice-generator
cp .env.example .env
nano .env
```

```env
APP_PORT=80
DB_NAME=invoice_generator
DB_USER=your_user
DB_PASSWORD=a_secure_password
JWT_SECRET=$(openssl rand -hex 64)
```

**4. Build and start**
```bash
docker compose up -d --build
```

**5. Run migrations (first time only)**
```bash
docker compose exec api node dist/config/migrate.js
```

**6. Check everything is running**
```bash
docker compose ps
docker compose logs api
```

### Useful commands

```bash
docker compose restart api          # Restart only the API
docker compose logs -f api          # Live logs
docker compose up -d --build api    # Rebuild and restart the API
docker compose down                 # Stop everything
```

---

## API Endpoints

### Authentication
| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Log in |
| `GET` | `/api/auth/me` | Get current user |

### Invoices
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/invoices` | List invoices (with filters) |
| `POST` | `/api/invoices` | Create invoice |
| `GET` | `/api/invoices/:id` | Get invoice by ID |
| `PUT` | `/api/invoices/:id` | Update invoice |
| `DELETE` | `/api/invoices/:id` | Delete invoice |
| `GET` | `/api/invoices/:id/pdf` | Download PDF |
| `GET` | `/api/invoices/stats` | Dashboard stats |
| `GET` | `/api/invoices/next-number` | Next invoice number |

### Share Links (WP entry for collaborators)
| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/invoices/:id/share` | Create share link (owner, draft only) |
| `GET` | `/api/invoices/:id/share` | Get share link info (owner) |
| `DELETE` | `/api/invoices/:id/share` | Revoke share link (owner) |
| `POST` | `/api/public/share/:token` | Access shared invoice (public, password required) |
| `PUT` | `/api/public/share/:token/wp` | Update WP numbers (public, password required) |

### Clients
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/clients` | List clients |
| `POST` | `/api/clients` | Create client |
| `GET` | `/api/clients/:id` | Get client |
| `PUT` | `/api/clients/:id` | Update client |
| `DELETE` | `/api/clients/:id` | Delete client |

### Profile
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/profile` | Get profile & settings |
| `PUT` | `/api/profile` | Update profile |
| `POST` | `/api/profile/logo` | Upload logo (`multipart/form-data`, field: `logo`) |
| `POST` | `/api/profile/signature` | Upload signature (`multipart/form-data`, field: `signature`) |

> All endpoints except `/api/auth/register`, `/api/auth/login`, and `/api/public/share/*` require:
> `Authorization: Bearer <token>`

---

## Database Schema

```
users               – Login credentials
profiles            – Personal info, bank details, logo & signature paths
clients             – Companies being billed
invoices            – Invoice header (number, date, status, total)
invoice_items       – Line items (description, hours, rate, amount)
invoice_share_tokens – Password-protected share links for WP entry
```

### Relationships

```
users    ──< profiles              (1:1)
users    ──< clients               (1:N)
users    ──< invoices              (1:N)
clients  ──< invoices              (1:N)
invoices ──< invoice_items         (1:N)
invoices ──< invoice_share_tokens  (1:1)
```

---

## Features

### Dashboard
- Counters: total, draft, sent, and paid invoices
- Total revenue and current month revenue
- Last 5 invoices with quick access links

### Invoices
- Auto-incremented number with 4-digit padding (`0075`, `0076` …)
- Status workflow: `draft` → `sent` → `paid`
- Dynamic line items: description, hours, rate, calculated amount
- Work period (start/end date used in notes)
- On-screen preview identical to the generated PDF
- Server-side PDF generation via Puppeteer

### Share for WP Entry
- Generate a password-protected link for any draft invoice
- Collaborators open the link, enter the password, and fill in Work Package numbers per task
- Only the WP field is editable — all other data is read-only
- Optional expiry date on the link
- Link can be revoked at any time by the owner

### Clients
- Full CRUD with modal
- Fields: name, address, city, postal code, country, VAT, email

### Settings
- **Personal**: name, VAT/tax ID, phone
- **Payment**: SWIFT/BIC, IBAN, bank name, default hourly rate, currency
- **Logo & Signature**: upload with live preview

### PDF Format
- Logo or initials (top left)
- Personal info (top right)
- Bill To + invoice number / date
- Task table with hours, rate, and amount
- Highlighted total
- SWIFT/BIC and IBAN
- Notes
- Signature image

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `DB_HOST` | PostgreSQL host | — |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `invoice_generator` |
| `DB_USER` | PostgreSQL user | — |
| `DB_PASSWORD` | PostgreSQL password | — |
| `JWT_SECRET` | Secret for signing tokens | — |
| `UPLOAD_DIR` | Upload directory | `uploads` |

---

## Available Scripts

### API
```bash
npm run dev      # Development with hot-reload (ts-node-dev)
npm run build    # Compile TypeScript to dist/
npm start        # Run compiled build
npm run migrate  # Create / update tables in PostgreSQL
```

### UI
```bash
npm start        # ng serve (port 4200)
npm run build    # Production build
```

---

*Developed with ❤️ by [Julio Poveda](https://juliopoveda.com)*
