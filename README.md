# Finly - Invoice Generator

<img width="1920" height="896" alt="image" src="https://github.com/user-attachments/assets/36b62e7a-15f8-409b-bdaf-54ab097aa951" />

A full-stack invoice management system built with Angular 18 and Express.js. Track daily tasks, generate professional invoices, export them as PDFs, and share them with collaborators for Work Package entry - all without requiring them to create an account.

The first registered user becomes the owner; everyone after that needs an invitation code.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 18 (standalone, signals, OnPush) + Tailwind CSS v3 |
| Backend | Express.js + TypeScript |
| Database | PostgreSQL |
| Authentication | JWT (jsonwebtoken + bcryptjs) |
| PDF Generation | Puppeteer (HTML → PDF, single reused browser) |
| File Uploads | Multer |
| Testing | `node:test` + supertest (API), Karma + Jasmine (UI) |
| Linting | ESLint + angular-eslint, Prettier |
| CI | GitHub Actions (lint, typecheck, tests against a real PostgreSQL) |
| Containerization | Docker + Docker Compose |

---

## Project Structure

```
invoice-generator/
├── docker-compose.yml
├── .env.example
├── .prettierrc
├── .github/workflows/ci.yml      # Lint + typecheck + tests on every push/PR
├── api/                          # Express + TypeScript backend
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts            # Validates env vars, exits if JWT_SECRET is weak
│   │   │   ├── database.ts       # PostgreSQL connection pool
│   │   │   ├── logger.ts         # JSON logs in production, plain text in dev
│   │   │   └── migrate.ts        # Migration script (tables, indexes, constraints)
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── rate-limit.middleware.ts
│   │   │   └── upload.middleware.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── invoices.routes.ts
│   │   │   ├── clients.routes.ts
│   │   │   ├── profile.routes.ts
│   │   │   ├── invite.routes.ts
│   │   │   └── share.routes.ts
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── invoices.controller.ts
│   │   │   ├── clients.controller.ts
│   │   │   ├── profile.controller.ts
│   │   │   ├── invite.controller.ts
│   │   │   └── share.controller.ts
│   │   ├── services/
│   │   │   └── pdf.service.ts    # Puppeteer PDF generation
│   │   ├── utils/
│   │   │   ├── pagination.ts     # Clamps page/limit (+ unit tests)
│   │   │   └── wp.ts             # Work Package tag parsing (+ unit tests)
│   │   ├── test/                 # Integration tests (auth, invoices, share)
│   │   ├── app.ts                # Express app — importable by tests
│   │   └── index.ts              # Server bootstrap + graceful shutdown
│   ├── eslint.config.js
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
    │   │   │   ├── guards/
    │   │   │   │   ├── auth.guard.ts
    │   │   │   │   └── unsaved-changes.guard.ts
    │   │   │   └── interceptors/auth.interceptor.ts
    │   │   ├── shared/
    │   │   │   ├── confirm/        # Accessible confirm dialog (replaces window.confirm)
    │   │   │   ├── money/          # Currency-aware amount pipe
    │   │   │   └── skeleton/       # Loading placeholders
    │   │   ├── layout/
    │   │   │   ├── shell/          # Responsive shell with off-canvas menu
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

- **Node.js** v20+
- **npm** v10+
- **PostgreSQL** accessible on the network
- **Docker + Docker Compose** (for production deployment)
- **Chrome or Chromium** (only to run the UI test suite; set `CHROME_BIN` if it is not on the default path)

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
DB_SSL=false
JWT_SECRET=a_long_random_secret_of_at_least_32_chars
UPLOAD_DIR=uploads
```

> **`JWT_SECRET` is mandatory.** The API refuses to start if it is missing, shorter
> than 32 characters, or a known-weak value such as `secret`. Generate one with:
> `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

Run migrations (creates tables, indexes and constraints):

```bash
npm run migrate
```

> The migration creates a unique index on `(user_id, invoice_number)`. If the table
> already holds duplicate numbers, the script lists them and stops so you can
> renumber them first.

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

nginx acts as a reverse proxy, so both the app and the API are served on the same origin - no CORS issues.

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
DB_SSL=false
JWT_SECRET=$(openssl rand -hex 64)
CORS_ORIGINS=            # leave empty when nginx serves UI and API on one origin
```

`docker-compose.yml` fails fast if `DB_PASSWORD` or `JWT_SECRET` are unset, so a
misconfigured deploy stops before the containers start.

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
| `GET` | `/api/invoices` | List invoices (filters, paging, sorting) |
| `POST` | `/api/invoices` | Create invoice (`409` on a duplicate number) |
| `GET` | `/api/invoices/:id` | Get invoice by ID |
| `PUT` | `/api/invoices/:id` | Update invoice |
| `DELETE` | `/api/invoices/:id` | Delete invoice |
| `POST` | `/api/invoices/:id/duplicate` | Duplicate an invoice or a template |
| `GET` | `/api/invoices/:id/pdf` | Download PDF |
| `GET` | `/api/invoices/stats` | Dashboard stats |
| `GET` | `/api/invoices/monthly-stats` | Revenue for the last 12 months |
| `GET` | `/api/invoices/next-number` | Next invoice number |

**Query parameters for `GET /api/invoices`**

| Parameter | Values | Notes |
|-----------|--------|-------|
| `page` | integer | Defaults to `1`; junk values fall back instead of erroring |
| `limit` | 1–100 | Defaults to `20`, capped at `100` |
| `sort` | `invoice_number` · `client_name` · `date` · `status` · `total` · `created_at` | Whitelisted; anything else falls back to `created_at` |
| `order` | `asc` · `desc` | Defaults to `desc` |
| `status` · `search` · `client_id` · `date_from` · `date_to` · `is_template` | — | Filters |

### System

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/health` | Liveness + database check (`503` if the DB is down) |

### Invitation Codes

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/invite-codes` | List codes |
| `POST` | `/api/invite-codes` | Generate a code |
| `DELETE` | `/api/invite-codes/:id` | Delete a code |

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
users                – Login credentials
profiles             – Personal info, bank details, logo & signature paths
clients              – Companies being billed
invoices             – Invoice header (number, date, status, total)
invoice_items        – Line items (description, hours, rate, amount)
invoice_share_tokens – Password-protected share links for WP entry
invitation_codes     – Single-use codes for registering after the first user
```

### Constraints & indexes

```
UNIQUE (user_id, invoice_number)   – no duplicate invoice numbers per user
INDEX  (user_id, date DESC)        – backs the default list ordering
INDEX  (user_id, status)           – backs the status filter
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
- Auto-incremented number with 4-digit padding (`0075`, `0076` …), unique per user
- Status workflow: `draft` → `sent` → `paid`
- Dynamic line items: description, hours, rate, calculated amount
- Work period (start/end date used in notes)
- On-screen preview identical to the generated PDF
- Server-side PDF generation via Puppeteer
- Paged list with server-side sorting on any column; the chosen order is remembered
  between sessions
- Bulk selection to mark several invoices as paid or delete them at once
- Amounts render in the client's currency, falling back to the profile default
- Autosave every 30s, plus a confirmation prompt before leaving with unsaved changes

### Share for WP Entry
- Generate a password-protected link for any draft invoice
- Collaborators open the link, enter the password, and fill in Work Package numbers per task
- Only the WP field is editable - all other data is read-only
- Optional expiry date on the link
- Link can be revoked at any time by the owner

### Clients
- Full CRUD with modal
- Fields: name, address, city, postal code, country, VAT, email

### Settings
- **Personal**: name, VAT/tax ID, phone
- **Payment**: SWIFT/BIC, IBAN, bank name, default hourly rate, currency
- **Logo & Signature**: upload with live preview

### Interface
- Works from phone to desktop: the sidebar becomes an off-canvas menu below `lg`,
  tables scroll horizontally and the A4 preview scales down instead of overflowing
- Skeleton placeholders while data loads, so the layout never jumps
- Keyboard shortcuts — list: `n` new invoice, `/` or `Ctrl+K` focus search;
  editor: `Ctrl+Enter` save, `Ctrl+I` add item, `Enter` on the last description adds a row
- Accessible confirm dialog instead of `window.confirm`, labelled form controls and
  visible keyboard focus throughout

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
| `NODE_ENV` | Environment (`test` disables rate limiting) | `development` |
| `DB_HOST` | PostgreSQL host | - |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `invoice_generator` |
| `DB_USER` | PostgreSQL user | - |
| `DB_PASSWORD` | PostgreSQL password | - |
| `DB_SSL` | Connect over TLS (`true` for most managed providers) | `false` |
| `JWT_SECRET` | **Required.** Min 32 chars — the API exits if missing or weak | - |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `CORS_ORIGINS` | Comma-separated allowed origins; empty in production behind nginx | dev localhost |
| `UPLOAD_DIR` | Upload directory | `uploads` |
| `MAX_FILE_SIZE` | Max upload size in bytes | `5242880` |

---

## Security

- **Fail-fast configuration** — the API refuses to boot without a strong `JWT_SECRET`;
  there are no insecure fallbacks anywhere in the codebase.
- **Rate limiting** — 10 login attempts / 15 min, 5 registrations / hour, and 10 share-link
  password attempts / 15 min, all per IP.
- **Uploads** — JPEG, PNG, GIF and WebP only. SVG is rejected because uploads are served
  from the same origin and could carry inline scripts. The stored extension comes from the
  declared MIME type, never from the client filename, and `/uploads` is served with a
  sandbox CSP and `nosniff`.
- **Share links** — the password is verified once, then a 2-hour session token signed for
  that specific link authorises the autosaves, so bcrypt does not run on every keystroke.
- **Database integrity** — real transactions on a dedicated connection, atomic invitation-code
  claiming, and a unique index preventing duplicate invoice numbers.
- **Headers** — helmet on the API; CSP, `X-Frame-Options`, `Referrer-Policy` and
  `Permissions-Policy` from nginx.
- **Container** — the API image runs as the unprivileged `node` user with `init: true` to reap
  Chromium's child processes.

---

## Testing & CI

```bash
# API — 36 tests. Integration tests skip automatically without a database.
cd api
npm run lint && npm run typecheck && npm test
npm run test:unit          # pure unit tests only, no database needed

# UI — 21 tests (Karma + Jasmine, headless)
cd ui
npm run lint && npm test
```

`.github/workflows/ci.yml` runs both suites on every push and pull request, spinning up a
PostgreSQL 16 service so the API integration tests actually execute.

---

## Available Scripts

### API

```bash
npm run dev           # Development with hot-reload (ts-node-dev)
npm run build         # Compile TypeScript to dist/
npm start             # Run compiled build
npm run migrate       # Create / update tables, indexes and constraints
npm test              # Unit + integration tests
npm run test:unit     # Unit tests only (no database required)
npm run typecheck     # tsc --noEmit
npm run lint          # ESLint
npm run format        # Prettier --write
```

### UI

```bash
npm start             # ng serve (port 4200)
npm run build         # Production build
npm test              # Karma + Jasmine, headless
npm run lint          # angular-eslint
npm run format        # Prettier --write
```

---

*Developed with ❤️ by [Julio Poveda](https://juliopoveda.com)*
