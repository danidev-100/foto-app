# Design: Booklet Ordering Application

> **Change**: booklet-ordering-app
> **Stack**: Node.js 20 LTS + Express 4.x + Prisma 5.x + PostgreSQL 16
> **Architecture**: Hexagonal (Ports & Adapters)
> **Slices**: 6 stacked PRs → main

---

## Technical Approach

Greenfield Node.js backend with 6 stacked slices. Each slice adds one bounded domain module. Slice 1 lays the full foundation (project init, config, Prisma client, Express setup, migrations, graceful shutdown). Slices 2–6 each add a domain ring (model → port → service → adapter) with repository, HTTP handler, and route registration. All 9 domain tables are created in Slice 1's single Prisma schema — subsequent slices only add code, never schema.

---

## Architecture Decisions

### Decision: Prisma ORM over raw pg / knex / Drizzle

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Raw `pg` | Full control, but manual SQL, type mapping, connection pooling | ❌ |
| Knex | Query builder, flexible, but no type-safe models | ❌ |
| Drizzle | Lightweight, SQL-like, newer ecosystem | ❌ |
| Prisma 5.x | Type-safe client, auto-migrations, relation handling, best DX | ✅ |

**Rationale**: Prisma gives us generated TypeScript types, `prisma.$transaction` for atomic operations, relation queries, and `prisma migrate` for schema management. Repository implementations wrap the Prisma client — the hexagonal port interface still isolates business logic from the ORM.

### Decision: Prisma migrations over raw SQL

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Raw SQL + custom runner | Full control, but manual tracking, no type sync | ❌ |
| Prisma migrate | Integrated with schema, auto type generation, `prisma migrate deploy` for production | ✅ |

**Rationale**: `prisma migrate deploy` is production-ready. Schema changes are a single source of truth. `prisma generate` keeps TypeScript types in sync automatically.

### Decision: UUID PKs over auto-increment

**Choice**: All PKs use `@default(uuid())` (UUID v4). Order IDs use `@default(cuid())` for time-sortable ordering.
**Rationale**: Prevents enumeration attacks, simplifies client-side ID generation. CUID adds time-sortable ordering for orders.

### Decision: Prisma `Decimal` for money

**Choice**: All monetary values use Prisma `Decimal` type, backed by `DECIMAL(65,30)` in PG.
**Rationale**: JavaScript `Number` loses precision on currency. Prisma's `Decimal` (based on `decimal.js`) handles arbitrary precision math safely.

### Decision: bcrypt cost 12

**Choice**: Password hashing with bcrypt cost factor 12 (~250ms per hash).
**Rationale**: Balanced security vs UX. Higher costs (14+) create DoS risk on auth endpoints.

### Decision: In-process webhook handling (no queue)

**Choice**: Handle MP webhooks synchronously in the Express handler.
**Rationale**: Low volume (one per payment event). `payment_events` table with upsert provides idempotency. Port interface supports extraction to background worker later.

---

## Data Flow

```
Student → Express HTTP → Auth Middleware (JWT check)
  → Handler (parse request, validate)
    → Service (business logic, validation)
      → Repository (Prisma queries)
        → PostgreSQL

Order Placement (transaction):
  POST /api/orders
    → prisma.$transaction([
        Lock student's cart (SELECT ... FOR UPDATE via raw query)
        Read cart items JOIN booklets (verify stock, snapshot price + title)
        INSERT order + order_items
        DELETE cart_items
        UPDATE booklets SET stock = stock - qty WHERE stock >= qty
        If MP: call SDK → create preference
      ])
```

---

## Package Structure

```
src/
├── index.ts                          — Entry point, Express init, graceful shutdown
├── config/
│   └── config.ts                     — Env-based config loading
├── domain/
│   ├── model/
│   │   ├── student.ts
│   │   ├── course.ts
│   │   ├── division.ts
│   │   ├── booklet.ts
│   │   ├── cart.ts
│   │   ├── cart-item.ts
│   │   ├── order.ts
│   │   ├── order-item.ts
│   │   ├── payment-event.ts
│   │   └── errors.ts                 — Domain error classes
│   ├── port/
│   │   ├── student.repository.ts
│   │   ├── course.repository.ts
│   │   ├── division.repository.ts
│   │   ├── booklet.repository.ts
│   │   ├── cart.repository.ts
│   │   ├── order.repository.ts
│   │   ├── payment-event.repository.ts
│   │   └── payment.provider.ts
│   └── service/
│       ├── auth.service.ts
│       ├── catalog.service.ts
│       ├── cart.service.ts
│       ├── order.service.ts
│       └── payment.service.ts
├── adapter/
│   ├── http/
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── admin.middleware.ts
│   │   │   ├── logger.middleware.ts
│   │   │   └── error.middleware.ts
│   │   ├── handler/
│   │   │   ├── health.handler.ts
│   │   │   ├── auth.handler.ts
│   │   │   ├── catalog.handler.ts
│   │   │   ├── cart.handler.ts
│   │   │   ├── order.handler.ts
│   │   │   └── payment.handler.ts
│   │   ├── router.ts
│   │   └── response.ts
│   ├── repository/
│   │   ├── student.repository.impl.ts
│   │   ├── course.repository.impl.ts
│   │   ├── division.repository.impl.ts
│   │   ├── booklet.repository.impl.ts
│   │   ├── cart.repository.impl.ts
│   │   ├── order.repository.impl.ts
│   │   └── payment-event.repository.impl.ts
│   ├── auth/
│   │   └── jwt.provider.ts
│   └── payment/
│       ├── mercadopago.provider.ts
│       └── cash.provider.ts
├── lib/
│   ├── prisma.ts                     — Prisma client singleton
│   └── logger.ts                     — Pino logger
prisma/
├── schema.prisma                     — All 9 domain models
├── migrations/                       — Prisma-generated migrations
└── seed.ts                           — Optional admin seed
```

---

## Slice 1 — Infrastructure Foundation

### package.json Dependencies

```json
{
  "dependencies": {
    "express": "^4.21.x",
    "@prisma/client": "^5.22.x",
    "prisma": "^5.22.x",
    "jsonwebtoken": "^9.0.x",
    "@types/jsonwebtoken": "^9.0.x",
    "bcrypt": "^5.1.x",
    "@types/bcrypt": "^5.0.x",
    "@mercadopago/sdk-js": "^0.0.3",
    "dotenv": "^16.4.x",
    "zod": "^3.23.x",
    "pino": "^9.5.x",
    "pino-http": "^10.3.x",
    "cors": "^2.8.x",
    "helmet": "^8.0.x",
    "decimal.js": "^10.4.x"
  },
  "devDependencies": {
    "typescript": "^5.6.x",
    "@types/express": "^5.0.x",
    "@types/node": "^22.x",
    "@types/cors": "^2.8.x",
    "ts-node": "^10.9.x",
    "tsx": "^4.19.x",
    "vitest": "^2.1.x",
    "@vitest/coverage-v8": "^2.1.x"
  }
}
```

### Config (`src/config/config.ts`)

```typescript
import { z } from 'zod';

const configSchema = z.object({
  serverPort: z.coerce.number().default(8080),
  databaseUrl: z.string().url(),
  jwtSecret: z.string().min(32),
  jwtExpiration: z.coerce.number().default(86400), // seconds (24h)
  mpAccessToken: z.string(),
  mpSandbox: z.coerce.boolean().default(true),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  shutdownTimeout: z.coerce.number().default(10000), // ms
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const result = configSchema.safeParse({
    serverPort: process.env.SERVER_PORT,
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiration: process.env.JWT_EXPIRATION,
    mpAccessToken: process.env.MP_ACCESS_TOKEN,
    mpSandbox: process.env.MP_SANDBOX,
    logLevel: process.env.LOG_LEVEL,
    shutdownTimeout: process.env.SHUTDOWN_TIMEOUT,
  });

  if (!result.success) {
    throw new Error(`Config validation failed: ${result.error.message}`);
  }

  return result.data;
}
```

### Prisma Client (`src/lib/prisma.ts`)

```typescript
import { PrismaClient } from '@prisma/client';

// Singleton pattern to avoid multiple connections in dev/hot-reload
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

### Migration Runner (`prisma/schema.prisma` + `prisma migrate deploy`)

```prisma
// All 9 models defined in a single schema.prisma
// Run: npx prisma migrate dev --name init (dev)
// Run: npx prisma migrate deploy (production)
// Run: npx prisma generate (after schema changes)

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Student {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  firstName String
  lastName  String
  courseId  String
  isAdmin   Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  course Course @relation(fields: [courseId], references: [id])
  cart   Cart?
  orders Order[]

  @@index([email])
  @@index([courseId])
}

model Course {
  id          String     @id @default(uuid())
  name        String
  isActive    Boolean    @default(true)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  divisions  Division[]
  students   Student[]

  @@index([isActive])
}

model Division {
  id        String   @id @default(uuid())
  name      String
  courseId  String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  course    Course    @relation(fields: [courseId], references: [id])
  booklets  Booklet[]

  @@index([courseId])
  @@index([isActive])
}

model Booklet {
  id          String   @id @default(uuid())
  title       String
  description String?
  price       Decimal  @db.Decimal(10, 2)
  stock       Int      @default(0)
  divisionId  String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  division    Division  @relation(fields: [divisionId], references: [id])
  cartItems   CartItem[]
  orderItems  OrderItem[]

  @@index([divisionId])
  @@index([isActive])
  @@index([stock])
}

model Cart {
  id        String   @id @default(uuid())
  studentId String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  student Student    @relation(fields: [studentId], references: [id])
  items   CartItem[]

  @@index([studentId])
}

model CartItem {
  id        String   @id @default(uuid())
  cartId    String
  bookletId String
  quantity  Int
  unitPrice Decimal  @db.Decimal(10, 2)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  cart    Cart    @relation(fields: [cartId], references: [id], onDelete: Cascade)
  booklet Booklet @relation(fields: [bookletId], references: [id])

  @@unique([cartId, bookletId])
  @@index([cartId])
  @@index([bookletId])
}

model Order {
  id          String   @id @default(cuid())
  studentId   String
  status      OrderStatus @default(PENDING)
  total       Decimal  @db.Decimal(10, 2)
  paymentMethod PaymentMethod
  mpPreferenceId String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  student Student     @relation(fields: [studentId], references: [id])
  items   OrderItem[]
  paymentEvents PaymentEvent[]

  @@index([studentId])
  @@index([status])
  @@index([createdAt(sort: Desc)])
}

enum OrderStatus {
  PENDING
  CONFIRMED
  PAID
  CANCELLED
  REFUNDED
}

enum PaymentMethod {
  MERCADOPAGO
  CASH
}

model OrderItem {
  id        String   @id @default(uuid())
  orderId   String
  bookletId String
  quantity  Int
  unitPrice Decimal  @db.Decimal(10, 2)
  title     String   // snapshot at order time
  createdAt DateTime @default(now())

  order   Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  booklet Booklet @relation(fields: [bookletId], references: [id])

  @@index([orderId])
  @@index([bookletId])
}

model PaymentEvent {
  id        String   @id @default(uuid())
  orderId   String?
  eventId   String   @unique // Mercado Pago event ID for idempotency
  type      String
  payload   Json?
  status    String
  createdAt DateTime @default(now())

  order   Order?  @relation(fields: [orderId], references: [id])

  @@index([orderId])
  @@index([eventId])
  @@index([type])
}
```

### Express App (`src/index.ts`)

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { loadConfig } from './config/config';
import { prisma } from './lib/prisma';
import { logger } from './lib/logger';
import { router } from './adapter/http/router';
import { errorMiddleware } from './adapter/http/middleware/error.middleware';

const config = loadConfig();

const app = express();

// Middleware: helmet → cors → pino-http → json
app.use(helmet());
app.use(cors({ origin: '*' })); // production: restrict to frontend domain
app.use(pinoHttp({ logger }));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api', router);

// Error handler (must be last)
app.use(errorMiddleware);

// Graceful shutdown
const server = app.listen(config.serverPort, () => {
  logger.info(`Server running on port ${config.serverPort}`);
});

const shutdownSignals = ['SIGINT', 'SIGTERM'] as const;
shutdownSignals.forEach((signal) => {
  process.on(signal, async () => {
    logger.info(`${signal} received, shutting down gracefully...`);
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('Server shut down');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown');
      process.exit(1);
    }, config.shutdownTimeout);
  });
});
```

### Error Handling Pattern

```typescript
// Domain error: class with code, message, statusCode, details
export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

// Response helper: errorResponse(res, statusCode, code, message, details)
// All errors return: { error: { code: "MOD_XXX", message: "...", details: {} } }
```

---

## Slice 2 — Auth Module

**Ports**: `StudentRepository` (create, findByEmail, findById)
**Service**: `AuthService` (register → bcrypt hash, login → JWT creation)
**JWT Claims**: `studentId`, `email`, `courseId`, `isAdmin`, `exp` (24h)
**Middleware**: Extracts Bearer token, validates via `jsonwebtoken`, injects claims into `req.user`

| Route | Handler | Auth |
|-------|---------|------|
| `POST /api/auth/register` | AuthHandler.register | No |
| `POST /api/auth/login` | AuthHandler.login | No |

**Key SQL**: `prisma.student.create()` with unique email constraint; Prisma error code `P2002` → 409 conflict.

---

## Slice 3 — Catalog Module

**Ports**: `CourseRepository`, `DivisionRepository`, `BookletRepository`
**Service**: `CatalogService` — student vs admin view (active + stock filter)

| Route | Handler | Auth |
|-------|---------|------|
| `GET /api/catalog/courses` | CatalogHandler.listCourses | Yes |
| `GET /api/catalog/courses/:id/divisions` | CatalogHandler.listDivisions | Yes |
| `GET /api/catalog/booklets` | CatalogHandler.listBooklets | Yes |
| `GET /api/catalog/booklets/:id` | CatalogHandler.getBooklet | Yes |
| `POST /api/admin/courses` | AdminCatalogHandler.createCourse | Admin |
| `PUT /api/admin/courses/:id` | AdminCatalogHandler.updateCourse | Admin |
| `DELETE /api/admin/courses/:id` | AdminCatalogHandler.deleteCourse | Admin |
| (same pattern for divisions and booklets) | | |

**Key Query**: `where: { isActive: true, stock: { gt: 0 } }` for students; admin bypasses.

---

## Slice 4 — Cart Module

**Ports**: `CartRepository` (getOrCreate, addItem, updateItemQuantity, removeItem, clear, listItems)
**One cart per student** (created on first add, `UNIQUE(student_id)` constraint).
**Price snapshot** at add time (JOIN booklets, store `unit_price` in cart_items).

| Route | Handler | Auth |
|-------|---------|------|
| `GET /api/cart` | CartHandler.list | Yes |
| `POST /api/cart/items` | CartHandler.addItem | Yes |
| `PUT /api/cart/items/:id` | CartHandler.updateItem | Yes |
| `DELETE /api/cart/items/:id` | CartHandler.removeItem | Yes |
| `DELETE /api/cart` | CartHandler.clear | Yes |

**Stock validation**: `prisma.booklet.findUnique({ where: { id } })` before add/update.

---

## Slice 5 — Order Module

**Ports**: `OrderRepository` (create, getById, listByStudent, listAll, updateStatus, cancelOrder)
**Critical transaction**: PlaceOrder uses `prisma.$transaction` with raw query for row-level locking. If stock check fails (`UPDATE ... WHERE stock >= quantity` returns 0 affected rows), rollback and return 409.

| Route | Handler | Auth |
|-------|---------|------|
| `POST /api/orders` | OrderHandler.placeOrder | Yes |
| `GET /api/orders` | OrderHandler.listMyOrders | Yes |
| `GET /api/orders/:id` | OrderHandler.getOrder | Yes |
| `POST /api/orders/:id/cancel` | OrderHandler.cancelOrder | Yes |
| `GET /api/admin/orders` | AdminOrderHandler.listAll | Admin |
| `PATCH /api/admin/orders/:id/status` | AdminOrderHandler.updateStatus | Admin |

---

## Slice 6 — Payment Module

**Port**: `PaymentProvider` (createPreference, optional processWebhook)
**Adapters**: `src/adapter/payment/mercadopago.provider.ts` (Mercado Pago SDK), `src/adapter/payment/cash.provider.ts` (stub)
**Idempotency**: `payment_events.event_id` UNIQUE constraint → duplicate webhook is safe upsert.

| Route | Handler | Auth |
|-------|---------|------|
| `POST /api/mercadopago/webhook` | PaymentHandler.handleWebhook | No (IPN) |
| `PATCH /api/admin/orders/:id/payment/confirm` | PaymentHandler.confirmCashPayment | Admin |

---

## Cross-Cutting Concerns

- **Logging**: `pino` + `pino-http` structured JSON. Request-scoped: request_id, student_id, method, path, status, duration.
- **Validation**: Handler-level via `zod`. Max lengths, email format, UUID format, positive ints.
- **Pagination envelope**: `{ data: [...], pagination: { page: 1, limit: 20, total: 57, totalPages: 3 } }`
- **CORS**: Wide-open for dev (`*`). Production restricted to frontend domain.
- **Error codes**: Prefix per module (AUTH, CAT, CART, ORD, PAY, INF).
- **TypeScript**: Strict mode, `noImplicitAny`, `strictNullChecks`, path aliases (`@/domain`, `@/adapter`, etc.)

---

## Testing Strategy

| Slice | What to Test | Approach |
|-------|-------------|----------|
| 1 | Config loading, Prisma connect, migration runner, health handler | Unit + integration (test DB) |
| 2 | Register (bcrypt, duplicate), Login (valid/invalid), JWT middleware | Service with mock repo; supertest for middleware |
| 3 | Booklet list filtering + pagination, student vs admin view | Integration with real Prisma client |
| 4 | AddItem (stock, price snapshot, increment), Clear, edge cases | Service with mock repo |
| 5 | PlaceOrder transaction (stock decrement, cart clear, snapshot), Cancel (stock restore) | Integration with real `$transaction` |
| 6 | Preference creation, webhook idempotency, cash confirm | Mock MP SDK; DB state verification |

---

## Migration / Rollout

- Single Prisma schema created in Slice 1 — all 9 models exist from day one.
- `npx prisma migrate dev --name init` for development.
- `npx prisma migrate deploy` for production CI/CD.
- Each slice is a separate PR merged into main (stacked approval chain).
- No feature flags required — additive API, endpoints register as slices merge.
- Migrations are idempotent (Prisma tracks applied migrations in `_prisma_migrations` table).

---

## Open Questions

- [ ] Do we have Mercado Pago sandbox credentials for development?
- [ ] Should Slice 1 include a seed script for an initial admin user?
- [ ] What is the frontend URL for production CORS configuration?
- [ ] Rate limiting: implement in Slice 1 (express-rate-limit) or defer to reverse proxy?
- [ ] Should we use `tsx` or `ts-node` for development? (`tsx` is faster)
