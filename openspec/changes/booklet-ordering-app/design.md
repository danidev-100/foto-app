# Design: Booklet Ordering Application

> **Change**: booklet-ordering-app
> **Stack**: Go 1.26.3 + Fiber v2 + pgx v5 + PostgreSQL 16
> **Architecture**: Hexagonal (Ports & Adapters)
> **Slices**: 6 stacked PRs → main

---

## Technical Approach

Greenfield Go backend with 6 stacked slices. Each slice adds one bounded domain module. Slice 1 lays the full foundation (module init, config, DB pool, Fiber setup, migrations, graceful shutdown). Slices 2–6 each add a domain ring (model → port → service → adapter) with repository, HTTP handler, and route registration. All 9 domain tables are created in Slice 1's single migration — subsequent slices only add code, never schema.

---

## Architecture Decisions

### Decision: Raw pgx over sqlx / GORM

| Option | Tradeoff | Decision |
|--------|----------|----------|
| GORM | Faster CRUD dev, but magic SQL, hard to tune, anti-hexagonal | ❌ |
| sqlx | Thin wrapper, nice scan, but another dep | ❌ |
| pgx v5 | Direct PostgreSQL driver, native pgtype, pool built-in, best perf | ✅ |

**Rationale**: pgx v5 gives us `pgxpool`, native UUID/DECIMAL via `pgtype`, `CollectRows` for clean scanning, `Batch` for bulk ops. Repository implementations own the SQL — no abstraction leak.

### Decision: Embedded migrations over golang-migrate

| Option | Tradeoff | Decision |
|--------|----------|----------|
| golang-migrate | External dep, CLI + library, migration locking | ❌ |
| embed + custom runner | Zero dep, full control, embed SQL via `//go:embed` | ✅ |

**Rationale**: Custom runner is ~60 lines. Track applied migrations in `schema_migrations` table. Apply sorted by filename. No version conflicts.

### Decision: UUID PKs over auto-increment

**Choice**: All PKs use `gen_random_uuid()` (UUID v4). Order IDs use v7 if `pg_uuidv7` extension available.
**Rationale**: Prevents enumeration attacks, simplifies client-side ID generation. v7 adds time-sortable ordering.

### Decision: `shopspring/decimal` for money

**Choice**: All monetary values use `shopspring/decimal` in Go, backed by `DECIMAL(10,2)` in PG.
**Rationale**: `float64` loses precision on currency. `decimal.Decimal` is the Go standard for money math.

### Decision: bcrypt cost 12

**Choice**: Password hashing with bcrypt cost factor 12 (~250ms per hash).
**Rationale**: Balanced security vs UX. Higher costs (14+) create DoS risk on auth endpoints.

### Decision: In-process webhook handling (no queue)

**Choice**: Handle MP webhooks synchronously in the HTTP handler.
**Rationale**: Low volume (one per payment event). `payment_events` table with upsert provides idempotency. Adapter interface supports extraction to background worker later.

---

## Data Flow

```
Student → Fiber HTTP → Auth Middleware (JWT check)
  → Handler (parse request, validate)
    → Service (business logic, validation)
      → Repository (pgx SQL queries)
        → PostgreSQL

Order Placement (transaction):
  POST /api/orders
    → Begin tx (SERIALIZABLE)
    → Lock student's cart (SELECT ... FOR UPDATE)
    → Read cart items JOIN booklets (verify stock, snapshot price + title)
    → INSERT order + order_items
    → DELETE cart_items
    → UPDATE booklets SET stock = stock - qty WHERE stock >= qty
    → If MP: call SDK → create preference
    → Commit tx
```

---

## Package Structure

```
cmd/api/main.go                     — Entry point, Fiber init, graceful shutdown
internal/
├── config/config.go                — Env-based config loading
├── domain/
│   ├── model/                      — Student, Course, Division, Booklet, Cart, CartItem, Order, OrderItem, PaymentEvent + errors.go
│   ├── port/                       — Repository interfaces + PaymentProvider interface
│   └── service/                    — AuthService, CatalogService, CartService, OrderService, PaymentService
└── adapter/
    ├── http/
    │   ├── middleware/{auth,admin,logger}.go
    │   ├── handler/{health,auth,catalog,cart,order,payment}_handler.go
    │   ├── router.go
    │   └── response.go
    ├── repository/{student,course,division,booklet,cart,order,payment}_repo.go
    ├── auth/jwt.go
    └── payment/{mp,cash}.go
pkg/
├── database/{pool,migrate}.go
├── jwt/jwt.go
└── response/response.go
migrations/{001_init.sql,002_add_indexes.sql}
```

---

## Slice 1 — Infrastructure Foundation

### go.mod Dependencies

```go
module github.com/foto-app/backend

go 1.26.3

require (
    github.com/gofiber/fiber/v2 v2.52.x
    github.com/jackc/pgx/v5 v5.7.x          // + pgxpool, pgtype
    github.com/golang-jwt/jwt/v5 v5.2.x
    github.com/joho/godotenv v1.5.x
    github.com/mercadopago/sdk-go v1.0.x
    github.com/shopspring/decimal v1.4.x
    golang.org/x/crypto v0.28.x             // bcrypt
    go.uber.org/zap v1.27.x                 // structured logging
)
```

### Config (`internal/config/config.go`)

```go
type Config struct {
    ServerPort      string        // default "8080"
    DatabaseURL     string        // required
    DBMaxConns      int           // default 25
    DBMinConns      int           // default 5
    JWTSecret       string        // required
    JWTExpiration   time.Duration // default 24h
    MPAccessToken   string        // required (for MP)
    MPSandbox       bool          // default true
    LogLevel        string        // default "info"
    ShutdownTimeout time.Duration // default 10s
}
// Load() uses godotenv then os.Getenv with defaults; returns error if required fields empty
```

### pgx Pool (`pkg/database/pool.go`)

```go
func NewPool(ctx context.Context, cfg *config.Config) (*pgxpool.Pool, error) {
    poolCfg, _ := pgxpool.ParseConfig(cfg.DatabaseURL)
    poolCfg.MaxConns = int32(cfg.DBMaxConns)
    poolCfg.MinConns = int32(cfg.DBMinConns)
    pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
    // Ping to verify connectivity
}
```

### Migration Runner (`pkg/database/migrate.go`)

```go
//go:embed ../../migrations/*.sql
var migrationsFS embed.FS

func RunMigrations(ctx context.Context, pool *pgxpool.Pool) error {
    // 1. CREATE TABLE IF NOT EXISTS schema_migrations (filename, applied_at)
    // 2. Read embedded .sql files sorted by name
    // 3. For each unapplied: BEGIN; exec SQL; INSERT record; COMMIT
}
```

### Fiber App (`cmd/api/main.go`)

```go
app := fiber.New(fiber.Config{
    ReadTimeout: 10s, WriteTimeout: 15s, IdleTimeout: 60s,
})
// Middleware: Logger(zap) → Recover → CORS(AllowOrigins: "*")
app.Get("/api/health", handler.HealthCheck)

// Graceful shutdown via signal.Notify(SIGINT, SIGTERM)
// app.ShutdownWithTimeout(cfg.ShutdownTimeout)
// pool.Close()
```

### Error Handling Pattern

```go
// Domain error: struct with Code, Message, Details
// Response helper: ErrorJSON(c, status, code, message, details)
// All errors return: {"error": {"code": "MOD_XXX", "message": "...", "details": {}}}
```

---

## Slice 2 — Auth Module

**Ports**: `StudentRepository` (Create, FindByEmail, FindByID)
**Service**: `AuthService` (Register → bcrypt hash, Login → JWT creation)
**JWT Claims**: `student_id`, `email`, `course_id`, `is_admin`, `exp` (24h)
**Middleware**: Extracts Bearer token, validates via `golang-jwt/jwt/v5`, injects claims into `c.Locals`

| Route | Handler | Auth |
|-------|---------|------|
| `POST /api/auth/register` | AuthHandler.Register | No |
| `POST /api/auth/login` | AuthHandler.Login | No |

**Key SQL**: `INSERT INTO students ...` with unique email constraint; pgx error code `23505` → 409 conflict.

---

## Slice 3 — Catalog Module

**Ports**: `CourseRepository`, `DivisionRepository`, `BookletRepository`
**Service**: `CatalogService` — student vs admin view (active + stock filter)

| Route | Handler | Auth |
|-------|---------|------|
| `GET /api/catalog/courses` | CatalogHandler.ListCourses | Yes |
| `GET /api/catalog/courses/:id/divisions` | CatalogHandler.ListDivisions | Yes |
| `GET /api/catalog/booklets` | CatalogHandler.ListBooklets | Yes |
| `GET /api/catalog/booklets/:id` | CatalogHandler.GetBooklet | Yes |
| `POST /api/admin/courses` | AdminCatalogHandler | Admin |
| `PUT /api/admin/courses/:id` | ... | Admin |
| `DELETE /api/admin/courses/:id` | ... | Admin |
| (same pattern for divisions and booklets) | | |

**Key Query**: `WHERE is_active = true AND stock > 0` for students; admin bypasses.

---

## Slice 4 — Cart Module

**Ports**: `CartRepository` (GetOrCreate, AddItem, UpdateItemQuantity, RemoveItem, Clear, ListItems)
**One cart per student** (created on first add, `UNIQUE(student_id)` constraint).
**Price snapshot** at add time (JOIN booklets, store `unit_price` in cart_items).

| Route | Handler | Auth |
|-------|---------|------|
| `GET /api/cart` | CartHandler.List | Yes |
| `POST /api/cart/items` | CartHandler.AddItem | Yes |
| `PUT /api/cart/items/:id` | CartHandler.UpdateItem | Yes |
| `DELETE /api/cart/items/:id` | CartHandler.RemoveItem | Yes |
| `DELETE /api/cart` | CartHandler.Clear | Yes |

**Stock validation**: `SELECT stock, is_active FROM booklets WHERE id = $1` before add/update.

---

## Slice 5 — Order Module

**Ports**: `OrderRepository` (Create, GetByID, ListByStudent, ListAll, UpdateStatus, CancelOrder)
**Critical transaction**: PlaceOrder uses `SERIALIZABLE` isolation. If stock check fails (`UPDATE ... WHERE stock >= quantity` returns 0 affected rows), rollback and return 409.

| Route | Handler | Auth |
|-------|---------|------|
| `POST /api/orders` | OrderHandler.PlaceOrder | Yes |
| `GET /api/orders` | OrderHandler.ListMyOrders | Yes |
| `GET /api/orders/:id` | OrderHandler.GetOrder | Yes |
| `POST /api/orders/:id/cancel` | OrderHandler.CancelOrder | Yes |
| `GET /api/admin/orders` | AdminOrderHandler.ListAll | Admin |
| `PATCH /api/admin/orders/:id/status` | AdminOrderHandler.UpdateStatus | Admin |

---

## Slice 6 — Payment Module

**Port**: `PaymentProvider` (CreatePreference, optional ProcessWebhook)
**Adapters**: `internal/adapter/payment/mp.go` (Mercado Pago SDK), `internal/adapter/payment/cash.go` (stub)
**Idempotency**: `payment_events.event_id` UNIQUE constraint → duplicate webhook is safe upsert.

| Route | Handler | Auth |
|-------|---------|------|
| `POST /api/mercadopago/webhook` | PaymentHandler.HandleWebhook | No (IPN) |
| `PATCH /api/admin/orders/:id/payment/confirm` | PaymentHandler.ConfirmCashPayment | Admin |

---

## Cross-Cutting Concerns

- **Logging**: `go.uber.org/zap` structured JSON. Request-scoped: request_id, student_id, method, path, status, duration.
- **Validation**: Handler-level via shared `validate.go`. Max lengths, email format, UUID format, positive ints.
- **Pagination envelope**: `{"data": [...], "pagination": {"page": 1, "limit": 20, "total": 57, "total_pages": 3}}`
- **CORS**: Wide-open for dev (`*`). Production restricted to frontend domain.
- **Error codes**: Prefix per module (AUTH, CAT, CART, ORD, PAY, INF).

---

## Testing Strategy

| Slice | What to Test | Approach |
|-------|-------------|----------|
| 1 | Config loading, pool connect, migration runner, health handler | Unit + integration (test DB) |
| 2 | Register (bcrypt, duplicate), Login (valid/invalid), JWT middleware | Service with mock repo; Fiber in-memory for middleware |
| 3 | Booklet list filtering + pagination, student vs admin view | Integration with real pgx pool |
| 4 | AddItem (stock, price snapshot, increment), Clear, edge cases | Service with mock repo |
| 5 | PlaceOrder transaction (stock decrement, cart clear, snapshot), Cancel (stock restore) | Integration with real tx |
| 6 | Preference creation, webhook idempotency, cash confirm | Mock MP SDK; DB state verification |

---

## Migration / Rollout

- Single `001_init.sql` created in Slice 1 — all 9 tables exist from day one.
- `002_add_indexes.sql` added in Slice 1 or Slice 5 (FK + query pattern indexes).
- Each slice is a separate PR merged into main (stacked approval chain).
- No feature flags required — additive API, endpoints register as slices merge.
- Migrations are idempotent (tracked by `schema_migrations` table).

---

## Open Questions

- [ ] Do we have Mercado Pago sandbox credentials for development?
- [ ] Should Slice 1 include a seed migration for an initial admin user?
- [ ] Is `pg_uuidv7` extension available, or use `gen_random_uuid()` (UUID v4)?
- [ ] What is the frontend URL for production CORS configuration?
- [ ] Rate limiting: implement in Slice 1 (Fiber limiter) or defer to reverse proxy?
