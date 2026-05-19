# Tasks: Booklet Ordering Application

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2,000–2,500 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 6 stacked PRs (one per slice) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Infrastructure foundation | PR 1 → main | go.mod, config, DB pool, migrations, Fiber app, health |
| 2 | Auth module | PR 2 → main | Students CRUD, JWT, register/login, auth middleware |
| 3 | Catalog module | PR 3 → main | Courses, divisions, booklets CRUD, public + admin routes |
| 4 | Cart module | PR 4 → main | Cart CRUD, price snapshot, stock validation |
| 5 | Order module | PR 5 → main | Order placement tx, cancellation, admin status updates |
| 6 | Payment module | PR 6 → main | MP webhook, cash confirm, payment_events |

## Slice 1: Infrastructure Foundation

- [ ] 1.1 Init Go module with all deps — go.mod, .env.example, .gitignore
- [ ] 1.2 Config struct with Load() — internal/config/config.go
- [ ] 1.3 pgxpool setup + Ping — pkg/database/pool.go
- [ ] 1.4 Embedded migration runner — pkg/database/migrate.go
- [ ] 1.5 001_init.sql (9 tables) + 002_add_indexes.sql — migrations/
- [ ] 1.6 DomainError + module-prefixed error vars — internal/domain/model/errors.go
- [ ] 1.7 ErrorJSON, SuccessJSON, PaginatedJSON — pkg/response/response.go
- [ ] 1.8 Zap logger middleware — internal/adapter/http/middleware/logger.go
- [ ] 1.9 Health handler + router skeleton — internal/adapter/http/handler/health.go, router.go
- [ ] 1.10 Wire main.go: config → pool → migrations → Fiber → graceful shutdown — cmd/api/main.go
- [ ] 1.11 Tests: config, pool ping, migration runner, health endpoint

## Slice 2: Auth Module

- [ ] 2.1 Student model — internal/domain/model/student.go
- [ ] 2.2 StudentRepository port (Create, FindByEmail, FindByID) — internal/domain/port/student_repository.go
- [ ] 2.3 JWT create/validate helpers — pkg/jwt/jwt.go
- [ ] 2.4 StudentRepo pgx adapter — internal/adapter/repository/student_repo.go
- [ ] 2.5 AuthService (Register bcrypt, Login JWT) — internal/domain/service/auth_service.go
- [ ] 2.6 Auth middleware (Bearer + JWT + c.Locals) + admin middleware — internal/adapter/http/middleware/auth.go, admin.go
- [ ] 2.7 AuthHandler + route registration — internal/adapter/http/handler/auth_handler.go, update router.go
- [ ] 2.8 Tests: duplicate email 409, invalid login 401, middleware blocks anonymous

## Slice 3: Catalog Module

- [ ] 3.1 Course, Division, Booklet models — internal/domain/model/{course,division,booklet}.go
- [ ] 3.2 CourseRepository, DivisionRepository, BookletRepository ports — internal/domain/port/
- [ ] 3.3 CourseRepo, DivisionRepo, BookletRepo adapters — internal/adapter/repository/{course,division,booklet}_repo.go
- [ ] 3.4 CatalogService (student vs admin view, active+stock filter) — internal/domain/service/catalog_service.go
- [ ] 3.5 CatalogHandler (public) + AdminCatalogHandler (CRUD) + routes — internal/adapter/http/handler/catalog_handler.go, update router.go
- [ ] 3.6 Tests: booklet list filtering, pagination, admin bypasses inactive filter

## Slice 4: Cart Module

- [ ] 4.1 Cart, CartItem models — internal/domain/model/{cart,cart_item}.go
- [ ] 4.2 CartRepository port (GetOrCreate, AddItem, UpdateQuantity, RemoveItem, Clear, ListItems) — internal/domain/port/cart_repository.go
- [ ] 4.3 CartRepo pgx adapter (price JOIN, stock guard) — internal/adapter/repository/cart_repo.go
- [ ] 4.4 CartService (price snapshot at add, stock validation, increment) — internal/domain/service/cart_service.go
- [ ] 4.5 CartHandler + routes — internal/adapter/http/handler/cart_handler.go, update router.go
- [ ] 4.6 Tests: add validates stock, price snapshot, clear cart, max qty

## Slice 5: Order Module

- [ ] 5.1 Order, OrderItem models — internal/domain/model/{order,order_item}.go
- [ ] 5.2 OrderRepository port (Create tx, GetByID, ListByStudent, ListAll, UpdateStatus, Cancel) — internal/domain/port/order_repository.go
- [ ] 5.3 OrderRepo pgx adapter (SERIALIZABLE tx, stock guard, stock restore on cancel) — internal/adapter/repository/order_repo.go
- [ ] 5.4 OrderService (PlaceOrder tx, CancelOrder restore stock) — internal/domain/service/order_service.go
- [ ] 5.5 OrderHandler (student) + AdminOrderHandler + routes — internal/adapter/http/handler/order_handler.go, update router.go
- [ ] 5.6 Tests: place order atomicity, cancel restores stock, oversell 409

## Slice 6: Payment Module

- [ ] 6.1 PaymentEvent model — internal/domain/model/payment_event.go
- [ ] 6.2 PaymentRepository + PaymentProvider ports — internal/domain/port/{payment_repository,payment_provider}.go
- [ ] 6.3 PaymentRepo adapter (upsert payment_events) — internal/adapter/repository/payment_repo.go
- [ ] 6.4 MP adapter (CreatePreference via SDK) + Cash stub — internal/adapter/payment/{mp,cash}.go
- [ ] 6.5 PaymentService (delegate to provider, record event) — internal/domain/service/payment_service.go
- [ ] 6.6 PaymentHandler (webhook, cash confirm) + routes — internal/adapter/http/handler/payment_handler.go, update router.go
- [ ] 6.7 Tests: webhook idempotency, cash confirm status transitions
