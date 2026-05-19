# Delta Spec: booklet-ordering-app

> **Change**: Booklet ordering application — digital booklet catalog, cart, and payment
> **Stack**: Go + Fiber + pgx + PostgreSQL
> **Architecture**: Hexagonal (Ports & Adapters)
> **Slices**: 6 PRs, stacked to main
> **Status**: Draft

---

## Slice 1 — Infrastructure Foundation

### Requirements

| ID | Description | Priority |
|---|---|---|
| INF-REQ-01 | Initialize Go module with dependencies: Fiber v2, pgx v5, godotenv, golang-jwt v5 | P0 |
| INF-REQ-02 | Load configuration from environment variables with defaults: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, MP_ACCESS_TOKEN, SERVER_PORT | P0 |
| INF-REQ-03 | Create PostgreSQL connection pool via pgx with configurable max connections (default 25) | P0 |
| INF-REQ-04 | Run SQL migrations on startup (embedding from `migrations/` directory) | P0 |
| INF-REQ-05 | Initialize Fiber app with structured logging, CORS middleware, and recovery middleware | P0 |
| INF-REQ-06 | Expose `GET /api/health` returning `{"status": "ok", "version": "1.0.0", "timestamp": "<rfc3339>"}` | P0 |
| INF-REQ-07 | Graceful shutdown with signal handling (SIGINT, SIGTERM) | P0 |
| INF-REQ-08 | Define the hexagonal directory structure: `cmd/api/`, `internal/domain/{model,port,service}/`, `internal/adapter/{http,repository,payment,auth}/`, `internal/config/`, `migrations/` | P0 |
| INF-REQ-09 | Create initial migration with all domain tables (see migration spec) | P0 |

### Scenarios

```gherkin
Scenario: Server starts and responds to health check
  Given the application is configured with valid environment variables
  When I start the server
  Then the server listens on the configured port (default 8080)
  And `GET /api/health` returns status 200 with body matching `{"status":"ok"}`
  And the response includes a `Content-Type: application/json` header

Scenario: Server shuts down gracefully
  Given the server is running
  When I send a SIGINT signal
  Then the server stops accepting new requests
  And existing in-flight requests complete within a configurable timeout (default 10s)
  And the database pool is closed
  And the process exits with code 0

Scenario: Missing required config causes startup failure
  Given the environment has no `DATABASE_URL` or equivalent connection params
  When I start the server
  Then startup fails with a clear error message indicating the missing configuration
  And the process exits with code 1

Scenario: Database migration runs on startup
  Given the database is empty
  When I start the server
  Then all `.sql` files in `migrations/` are executed in order
  And the `schema_migrations` table is created tracking which migrations ran

Scenario: Database connection failure prevents startup
  Given the database is unreachable
  When I start the server
  Then the application logs the connection error
  And exits with code 1 within the configured connection timeout
```

### Acceptance Criteria

- `go build ./...` compiles without errors
- `go run ./cmd/api` starts the server and responds to `GET /api/health`
- `curl http://localhost:8080/api/health` returns HTTP 200 with JSON body
- All 8 domain tables exist after first startup (verified via `psql \dt`)
- Graceful shutdown: `curl` response before kill, no `connection refused` during window
- Config validation: missing `DATABASE_URL` → clear error + exit 1

### Non-Functional

| Aspect | Constraint |
|---|---|
| Startup time | < 2 seconds from `go run` to health endpoint ready |
| Graceful shutdown | Hard deadline: max 30s wait, then force exit |
| Migration ordering | Files must be lexicographically ordered (use `001_*.sql`, `002_*.sql`, etc.) |
| Config precedence | Env var > `.env` file > default value |
| Logging | Structured JSON logs to stdout, minimum level configurable via `LOG_LEVEL` env var |

---

## Slice 2 — Auth Module (Student Registration + JWT Login)

### Requirements

| ID | Description | Priority |
|---|---|---|
| AUTH-REQ-01 | Student registers with name, email, password, phone (optional), course_id | P0 |
| AUTH-REQ-02 | Email uniqueness is enforced at the database level (unique constraint) | P0 |
| AUTH-REQ-03 | Password is hashed using bcrypt with cost factor 12 | P0 |
| AUTH-REQ-04 | Registration returns created student without password hash | P0 |
| AUTH-REQ-05 | Login accepts email + password, returns JWT access token | P0 |
| AUTH-REQ-06 | JWT token includes student_id, email, course_id in claims | P0 |
| AUTH-REQ-07 | Token expiration: 24 hours from issuance | P0 |
| AUTH-REQ-08 | JWT auth middleware extracts and validates token from `Authorization: Bearer <token>` header | P0 |
| AUTH-REQ-09 | Invalid/expired tokens return 401 with structured error | P0 |
| AUTH-REQ-10 | `POST /api/auth/register` — register endpoint | P0 |
| AUTH-REQ-11 | `POST /api/auth/login` — login endpoint | P0 |

### Model

```go
// Student
type Student struct {
    ID        uuid.UUID   `json:"id"`
    Name      string      `json:"name"`
    Email     string      `json:"email"`
    Password  string      `json:"-"`        // never serialized
    Phone     *string     `json:"phone,omitempty"`
    CourseID  uuid.UUID   `json:"course_id"`
    CreatedAt time.Time   `json:"created_at"`
    UpdatedAt time.Time   `json:"updated_at"`
}
```

### Ports

```go
// StudentRepository (output port)
type StudentRepository interface {
    Create(ctx context.Context, s *Student) error
    FindByEmail(ctx context.Context, email string) (*Student, error)
    FindByID(ctx context.Context, id uuid.UUID) (*Student, error)
}

// AuthService (input port / use case)
type AuthService interface {
    Register(ctx context.Context, req RegisterRequest) (*Student, error)
    Login(ctx context.Context, req LoginRequest) (*LoginResponse, error)
}
```

### Scenarios

```gherkin
Scenario: Successful student registration
  Given I have valid registration data: name, email, password, course_id
  When I POST to `/api/auth/register` with that data
  Then the response status is 201
  And the response body contains the student with id, name, email, course_id, created_at
  And the response body does NOT contain the password field
  And the password is stored as a bcrypt hash in the database

Scenario: Duplicate email registration fails
  Given a student with email "test@example.com" already exists
  When I POST to `/api/auth/register` with email "test@example.com"
  Then the response status is 409 (Conflict)
  And the error message indicates the email is already registered

Scenario: Registration with invalid data
  When I POST to `/api/auth/register` with empty name
  Then the response status is 400 (Bad Request)
  And the error response includes validation details

Scenario: Successful login
  Given a student with email "student@example.com" and password "securePass123!" exists
  When I POST to `/api/auth/login` with email and password
  Then the response status is 200
  And the response body contains a `token` field with a valid JWT string
  And decoding the JWT reveals claims: student_id, email, course_id, exp (24h)

Scenario: Login with wrong password
  Given a student with email "student@example.com" exists
  When I POST to `/api/auth/login` with correct email but wrong password
  Then the response status is 401 (Unauthorized)
  And the error message indicates invalid credentials

Scenario: Login with non-existent email
  When I POST to `/api/auth/login` with email "nonexistent@example.com"
  Then the response status is 401 (Unauthorized)

Scenario: Authenticated request with valid token
  Given I have a valid JWT token for a student
  When I make a GET request to a protected endpoint with `Authorization: Bearer <token>`
  Then the request proceeds, and context contains student_id, email, course_id

Scenario: Authenticated request with expired token
  Given I have an expired JWT token
  When I make a request with `Authorization: Bearer <expired_token>`
  Then the response status is 401
  And the error indicates the token is expired

Scenario: Authenticated request with malformed token
  When I make a request with `Authorization: Bearer invalid-token-here`
  Then the response status is 401
  And the error indicates the token is invalid

Scenario: Authenticated request without token
  When I make a request to a protected endpoint without an Authorization header
  Then the response status is 401
  And the error indicates authentication is required
```

### Acceptance Criteria

- `POST /api/auth/register` with valid data → 201 + student JSON (no password)
- `POST /api/auth/register` with duplicate email → 409
- `POST /api/auth/login` with valid credentials → 200 + JWT token
- `POST /api/auth/login` with wrong password → 401
- JWT token decodes to correct claims and expires after 24h
- Auth middleware rejects missing/invalid/expired tokens with 401
- All endpoints are tested in isolation (service unit tests with mock repo)

### Non-Functional

| Aspect | Constraint |
|---|---|
| Password storage | bcrypt, cost factor 12 minimum |
| Token signing | HMAC-SHA256 with configurable secret |
| Rate limiting | Login endpoint: max 10 requests/min per IP (configurable) |
| Registration | Max 5 registrations/min per IP (configurable) |
| Input validation | Max field lengths: name 255, email 255, password 128 |
| Error response format | `{"error": {"code": "AUTH_001", "message": "..."}}` |

---

## Slice 3 — Catalog Module (Courses, Divisions, Booklets)

### Requirements

| ID | Description | Priority |
|---|---|---|
| CAT-REQ-01 | Admin CRUD for courses: name, code (unique), description | P0 |
| CAT-REQ-02 | Admin CRUD for divisions: name, code (unique, e.g. "1A", "2B"), course_id FK | P0 |
| CAT-REQ-03 | Admin CRUD for booklets: title, description, course_id, division_id, type (enum: b/w, color), price (decimal), stock (int), cover_image_url (optional), is_active (bool) | P0 |
| CAT-REQ-04 | Student can browse booklets filtered by course_id (optionally division_id) | P0 |
| CAT-REQ-05 | Student can view single booklet details (title, description, type, price, stock, cover image) | P0 |
| CAT-REQ-06 | Student catalog listing returns only `is_active = true` booklets with `stock > 0` | P0 |
| CAT-REQ-07 | Admin catalog includes inactive and out-of-stock items | P0 |
| CAT-REQ-08 | Catalog listing is paginated (20 items/page, page query param) | P0 |
| CAT-REQ-09 | `GET /api/catalog/courses` — list courses (public) | P0 |
| CAT-REQ-10 | `GET /api/catalog/courses/:course_id/divisions` — list divisions for a course (public) | P0 |
| CAT-REQ-11 | `GET /api/catalog/booklets?course_id=...&division_id=...&page=1` — browse booklets (student) | P0 |
| CAT-REQ-12 | `GET /api/catalog/booklets/:id` — booklet detail (student) | P0 |
| CAT-REQ-13 | `POST/PUT/DELETE /api/admin/courses/:id` — admin course CRUD | P1 |
| CAT-REQ-14 | `POST/PUT/DELETE /api/admin/divisions/:id` — admin division CRUD | P1 |
| CAT-REQ-15 | `POST/PUT/DELETE /api/admin/booklets/:id` — admin booklet CRUD | P1 |

### Model

```go
type Course struct {
    ID          uuid.UUID `json:"id"`
    Name        string    `json:"name"`
    Code        string    `json:"code"`
    Description string    `json:"description"`
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}

type Division struct {
    ID        uuid.UUID `json:"id"`
    CourseID  uuid.UUID `json:"course_id"`
    Name      string    `json:"name"`
    Code      string    `json:"code"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

type BookletType string
const (
    BookletTypeBW     BookletType = "bw"
    BookletTypeColor  BookletType = "color"
)

type Booklet struct {
    ID            uuid.UUID   `json:"id"`
    Title         string      `json:"title"`
    Description   string      `json:"description"`
    CourseID      uuid.UUID   `json:"course_id"`
    DivisionID    uuid.UUID   `json:"division_id"`
    Type          BookletType `json:"type"`
    Price         decimal.Decimal `json:"price"`
    Stock         int         `json:"stock"`
    CoverImageURL *string     `json:"cover_image_url,omitempty"`
    IsActive      bool        `json:"is_active"`
    CreatedAt     time.Time   `json:"created_at"`
    UpdatedAt     time.Time   `json:"updated_at"`
}
```

### Scenarios

```gherkin
Scenario: Student browses booklets by course
  Given course "3ero" with id "c-123" exists
  And 25 booklets exist for course "c-123", all active and in stock
  When I GET `/api/catalog/booklets?course_id=c-123&page=1`
  Then the response status is 200
  And the response contains `data` array with 20 booklets
  And the response contains `pagination` with `page: 1`, `limit: 20`, `total: 25`, `total_pages: 2`

Scenario: Student browses booklets by course and division
  Given course "c-123" with division "1A" (id "d-456") exists
  And 5 booklets exist for course "c-123" and division "d-456"
  When I GET `/api/catalog/booklets?course_id=c-123&division_id=d-456`
  Then the response status is 200
  And all returned booklets have `division_id: "d-456"`
  And `pagination.total` is 5

Scenario: Student does not see inactive booklets
  Given a booklet with `is_active: false` exists
  When I GET `/api/catalog/booklets?course_id=...`
  Then the inactive booklet is NOT in the results

Scenario: Student does not see out-of-stock booklets
  Given a booklet with `stock: 0` exists
  When I GET `/api/catalog/booklets?course_id=...`
  Then the out-of-stock booklet is NOT in the results

Scenario: Student views single booklet detail
  Given a booklet with id "b-789" exists
  When I GET `/api/catalog/booklets/b-789`
  Then the response status is 200
  And the response body contains all booklet fields: id, title, description, price, stock, type, course_id, division_id, cover_image_url, is_active

Scenario: Student views non-existent booklet
  When I GET `/api/catalog/booklets/non-existent-id`
  Then the response status is 404
  And the error indicates the booklet was not found

Scenario: Admin creates a new booklet
  Given I am authenticated as an admin
  When I POST `/api/admin/booklets` with valid booklet data
  Then the response status is 201
  And the response contains the created booklet with an id
  And the booklet persists in the database

Scenario: Admin updates booklet price
  Given a booklet exists with price 500.00
  When I PUT `/api/admin/booklets/:id` with price: 600.00
  Then the response status is 200
  And the updated booklet has price 600.00
  And the `updated_at` timestamp is refreshed

Scenario: Admin deletes a booklet
  Given a booklet exists
  When I DELETE `/api/admin/booklets/:id`
  Then the response status is 204 (No Content)
  And the booklet is removed from the database

Scenario: Unauthenticated request to admin endpoint
  When I POST `/api/admin/booklets` without an auth token
  Then the response status is 401

Scenario: Non-admin attempts admin action
  Given I am authenticated as a regular student
  When I POST `/api/admin/booklets`
  Then the response status is 403 (Forbidden)
```

### Acceptance Criteria

- Student catalog browsing returns paginated results, filtered by course_id and optionally division_id
- Inactive and out-of-stock booklets are hidden from student views
- Admin CRUD endpoints work for courses, divisions, and booklets
- Admin endpoints require authentication + admin role
- Pagination metadata is correct across multiple pages
- 404 for non-existent booklets and courses

### Non-Functional

| Aspect | Constraint |
|---|---|
| Pagination limit | Max 100 items/page (configurable) |
| Price precision | Decimal(10,2) stored in database |
| Listing latency | < 200ms for any catalog query with pagination |
| Booklet title length | 3–255 characters |
| Price range | 0.01–999999.99 |
| Stock | Non-negative integer |

---

## Slice 4 — Cart Module

### Requirements

| ID | Description | Priority |
|---|---|---|
| CART-REQ-01 | Authenticated student can add a booklet to cart: booklet_id, quantity (default 1) | P0 |
| CART-REQ-02 | Adding a booklet that is already in cart increments the quantity | P0 |
| CART-REQ-03 | Cart item quantity cannot exceed available stock | P0 |
| CART-REQ-04 | Only active, in-stock booklets can be added | P0 |
| CART-REQ-05 | Student can update cart item quantity (PUT) | P0 |
| CART-REQ-06 | Student can remove a cart item (DELETE) | P0 |
| CART-REQ-07 | Student can clear entire cart (DELETE all) | P0 |
| CART-REQ-08 | Student can list cart items with booklet details (title, cover, price) and subtotal per item | P0 |
| CART-REQ-09 | Cart total is computed server-side and returned in the list response | P0 |
| CART-REQ-10 | Cart persists across sessions (database-backed, not in-memory) | P0 |
| CART-REQ-11 | Each student has exactly one cart (created on first add) | P0 |
| CART-REQ-12 | `GET /api/cart` — list cart items with totals | P0 |
| CART-REQ-13 | `POST /api/cart/items` — add item to cart | P0 |
| CART-REQ-14 | `PUT /api/cart/items/:item_id` — update item quantity | P0 |
| CART-REQ-15 | `DELETE /api/cart/items/:item_id` — remove item | P0 |
| CART-REQ-16 | `DELETE /api/cart` — clear entire cart | P0 |

### Model

```go
type Cart struct {
    ID        uuid.UUID `json:"id"`
    StudentID uuid.UUID `json:"student_id"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

type CartItem struct {
    ID        uuid.UUID       `json:"id"`
    CartID    uuid.UUID       `json:"cart_id"`
    BookletID uuid.UUID       `json:"booklet_id"`
    Quantity  int             `json:"quantity"`
    UnitPrice decimal.Decimal `json:"unit_price"` // snapshot from booklet at add time
    CreatedAt time.Time       `json:"created_at"`
    UpdatedAt time.Time       `json:"updated_at"`

    // Joined fields for list response
    BookletTitle string `json:"booklet_title,omitempty"`
    BookletCover string `json:"booklet_cover,omitempty"`
    Subtotal     decimal.Decimal `json:"subtotal,omitempty"`
}
```

### Scenarios

```gherkin
Scenario: Add booklet to empty cart
  Given I am an authenticated student
  And a booklet exists with stock 10
  When I POST `/api/cart/items` with `{"booklet_id": "b-1", "quantity": 2}`
  Then the response status is 201
  And the response contains the cart item with booklet_id "b-1", quantity 2
  And the unit_price matches the booklet's current price

Scenario: Add same booklet again increments quantity
  Given my cart already has booklet "b-1" with quantity 2
  When I POST `/api/cart/items` with `{"booklet_id": "b-1", "quantity": 1}`
  Then the response status is 200
  And the cart item for "b-1" now has quantity 3

Scenario: Adding booklet exceeding stock fails
  Given booklet "b-1" has stock 5
  And my cart already has 4 of "b-1"
  When I POST `/api/cart/items` with `{"booklet_id": "b-1", "quantity": 2}` (trying to make total 6)
  Then the response status is 400 (Bad Request)
  And the error indicates insufficient stock

Scenario: Adding inactive booklet fails
  Given booklet "b-2" has `is_active: false`
  When I POST `/api/cart/items` with `{"booklet_id": "b-2", "quantity": 1}`
  Then the response status is 400
  And the error indicates the booklet is not available

Scenario: List cart items with totals
  Given my cart has booklet "b-1" (price 100, qty 2) and "b-2" (price 50, qty 3)
  When I GET `/api/cart`
  Then the response status is 200
  And the response contains `items` array with 2 entries
  And item "b-1" has `subtotal: 200`
  And item "b-2" has `subtotal: 150`
  And `total: 350`

Scenario: Update cart item quantity
  Given my cart has booklet "b-1" with quantity 2
  When I PUT `/api/cart/items/:item_id` with `{"quantity": 5}`
  And booklet "b-1" has stock >= 5
  Then the response status is 200
  And the item now has quantity 5

Scenario: Remove item from cart
  Given my cart has 2 items
  When I DELETE `/api/cart/items/:item_id`
  Then the response status is 204
  And the cart item is removed
  And listing the cart now shows 1 item

Scenario: Clear entire cart
  Given my cart has 3 items
  When I DELETE `/api/cart`
  Then the response status is 204
  And listing the cart returns an empty items array

Scenario: Cart list requires authentication
  When I GET `/api/cart` without a token
  Then the response status is 401

Scenario: Empty cart returns empty array
  Given my cart has no items (or does not exist yet)
  When I GET `/api/cart`
  Then the response status is 200
  And `items` is an empty array
  And `total` is 0
```

### Acceptance Criteria

- Cart items persist in database across requests
- Stock validation prevents over-ordering
- Price snapshot is taken at add time (not when browsing)
- Cart totals are computed server-side (never trust client)
- All cart operations require valid JWT auth
- Cart automatically created on first item addition

### Non-Functional

| Aspect | Constraint |
|---|---|
| Max cart items | 50 items per cart (configurable) |
| Max quantity per item | 99 (configurable) |
| Price snapshot | Unit price stored at add time, NOT recalculated from booklet |
| Concurrency | Serialize cart operations per student (row-level lock on cart) |
| Response size | Cart list response < 10KB for 50 items |

---

## Slice 5 — Order Module

### Requirements

| ID | Description | Priority |
|---|---|---|
| ORD-REQ-01 | Order is created from the student's current cart (cart → order) | P0 |
| ORD-REQ-02 | Cart is cleared after successful order placement | P0 |
| ORD-REQ-03 | Stock is decremented when order is created | P0 |
| ORD-REQ-04 | Order status flow: `pending` → `confirmed` → `in_progress` → `ready` → `delivered` | P0 |
| ORD-REQ-05 | Payment method is specified at order creation: `cash` or `mercadopago` | P0 |
| ORD-REQ-06 | Order line items are snapshots of cart items at order time (booklet_id, title, quantity, unit_price) | P0 |
| ORD-REQ-07 | Order has an estimated total computed server-side | P0 |
| ORD-REQ-08 | Student can list their own orders (newest first) | P0 |
| ORD-REQ-09 | Student can view single order detail with line items | P0 |
| ORD-REQ-10 | Student can cancel their order IF status is `pending` | P0 |
| ORD-REQ-11 | Cancelling restores stock for each line item | P0 |
| ORD-REQ-12 | Admin can list all orders with status filter | P0 |
| ORD-REQ-13 | Admin can update order status | P0 |
| ORD-REQ-14 | `POST /api/orders` — place order (from cart) | P0 |
| ORD-REQ-15 | `GET /api/orders` — student's orders (paginated) | P0 |
| ORD-REQ-16 | `GET /api/orders/:id` — order detail | P0 |
| ORD-REQ-17 | `POST /api/orders/:id/cancel` — cancel order | P0 |
| ORD-REQ-18 | `GET /api/admin/orders?status=...&page=1` — admin list | P1 |
| ORD-REQ-19 | `PATCH /api/admin/orders/:id/status` — admin status update | P1 |

### Model

```go
type OrderStatus string
const (
    OrderStatusPending     OrderStatus = "pending"
    OrderStatusConfirmed   OrderStatus = "confirmed"
    OrderStatusInProgress  OrderStatus = "in_progress"
    OrderStatusReady       OrderStatus = "ready"
    OrderStatusDelivered   OrderStatus = "delivered"
    OrderStatusCancelled   OrderStatus = "cancelled"
)

type PaymentMethod string
const (
    PaymentMethodCash         PaymentMethod = "cash"
    PaymentMethodMercadoPago  PaymentMethod = "mercadopago"
)

type Order struct {
    ID            uuid.UUID       `json:"id"`
    StudentID     uuid.UUID       `json:"student_id"`
    Status        OrderStatus     `json:"status"`
    Total         decimal.Decimal `json:"total"`
    PaymentMethod PaymentMethod   `json:"payment_method"`
    PaymentStatus string          `json:"payment_status"` // pending, paid, failed, refunded
    Notes         *string         `json:"notes,omitempty"`
    CreatedAt     time.Time       `json:"created_at"`
    UpdatedAt     time.Time       `json:"updated_at"`
    Items         []OrderItem     `json:"items,omitempty"`
}

type OrderItem struct {
    ID          uuid.UUID       `json:"id"`
    OrderID     uuid.UUID       `json:"order_id"`
    BookletID   uuid.UUID       `json:"booklet_id"`
    Title       string          `json:"title"`
    Quantity    int             `json:"quantity"`
    UnitPrice   decimal.Decimal `json:"unit_price"`
    Subtotal    decimal.Decimal `json:"subtotal"`
}
```

### Scenarios

```gherkin
Scenario: Student places order from cart with sufficient stock
  Given I am an authenticated student
  And my cart has 2 items: booklet "b-1" (qty 2, price 100) and "b-2" (qty 1, price 50)
  And both booklets have sufficient stock
  When I POST `/api/orders` with `{"payment_method": "cash"}`
  Then the response status is 201
  And the order has status "pending"
  And the order contains 2 items with matching details
  And the order total is 250
  And my cart is now empty
  And booklet "b-1" stock decreased by 2
  And booklet "b-2" stock decreased by 1

Scenario: Place order with insufficient stock
  Given my cart has booklet "b-1" (qty 5)
  And booklet "b-1" has stock 3
  When I POST `/api/orders`
  Then the response status is 409 (Conflict)
  And the error indicates insufficient stock for "b-1"
  And the cart remains unchanged
  And stock is NOT modified

Scenario: Place order with empty cart
  Given my cart is empty
  When I POST `/api/orders`
  Then the response status is 400
  And the error indicates the cart is empty

Scenario: Student lists their orders
  Given I have placed 3 orders
  When I GET `/api/orders`
  Then the response status is 200
  And the response contains 3 orders, ordered by created_at DESC
  And each order has id, status, total, payment_method, created_at

Scenario: Student views order detail
  Given I have an order with id "ord-123"
  When I GET `/api/orders/ord-123`
  Then the response status is 200
  And the order includes `items` array with snapshot details (title, quantity, unit_price, subtotal per item)

Scenario: Student views another student's order
  Given order "ord-999" belongs to a different student
  When I GET `/api/orders/ord-999`
  Then the response status is 404 (not found — never reveal other orders exist)

Scenario: Student cancels pending order — stock restored
  Given my order "ord-123" has status "pending"
  And it contains booklet "b-1" (qty 2)
  When I POST `/api/orders/ord-123/cancel`
  Then the response status is 200
  And the order status is "cancelled"
  And booklet "b-1" stock is increased by 2

Scenario: Student cannot cancel non-pending order
  Given my order "ord-123" has status "confirmed"
  When I POST `/api/orders/ord-123/cancel`
  Then the response status is 400
  And the error indicates the order cannot be cancelled in its current status

Scenario: Admin updates order status
  Given order "ord-123" has status "pending"
  When I PATCH `/api/admin/orders/ord-123/status` with `{"status": "confirmed"}`
  Then the response status is 200
  And the order status is "confirmed"

Scenario: Admin lists orders filtered by status
  Given there are orders with various statuses
  When I GET `/api/admin/orders?status=pending`
  Then only orders with status "pending" are returned
```

### Acceptance Criteria

- Placing an order converts cart to order items atomically (transaction)
- Cart is cleared on successful order placement
- Stock is decremented atomically with order creation
- Cancelling a pending order restores stock
- Students can only see their own orders
- Order line items are immutable snapshots (price locked at order time)
- Status transitions follow the defined state machine

### Non-Functional

| Aspect | Constraint |
|---|---|
| Order creation | Must be atomic (single transaction: create order, create items, clear cart, decrement stock) |
| Stock consistency | Use `UPDATE ... WHERE stock >= quantity` with row-level locking to prevent overselling |
| Pagination | Orders list: 10 items/page, max 50 |
| Status transitions | `pending` → any; `cancelled` is terminal; `delivered` is terminal |
| Order ID format | UUID v7 (time-sortable) for natural ordering |

### Order Status State Machine

```
pending ──► confirmed ──► in_progress ──► ready ──► delivered
  │                                                       │
  └──► cancelled                                          └──► (terminal)
```

---

## Slice 6 — Payment Module

### Requirements

| ID | Description | Priority |
|---|---|---|
| PAY-REQ-01 | On order creation with `mercadopago` method, create a Mercado Pago Checkout Pro preference | P0 |
| PAY-REQ-02 | Preference includes: title (order ID), quantity, unit_price, external_reference (order_id), back_urls (success, failure, pending), auto_return ("approved") | P0 |
| PAY-REQ-03 | Preference creation response includes the `init_point` URL for checkout redirect | P0 |
| PAY-REQ-04 | Store the Mercado Pago preference_id and init_point URL on the order | P0 |
| PAY-REQ-05 | POST /api/mercadopago/webhook — receive IPN notifications | P0 |
| PAY-REQ-06 | Webhook validates the notification is genuine (verify signature / topic) | P0 |
| PAY-REQ-07 | On `payment.approved` notification, update order status to `confirmed` and payment_status to `paid` | P0 |
| PAY-REQ-08 | On `payment.failed` or `payment.refunded`, update payment_status accordingly | P0 |
| PAY-REQ-09 | For `cash` payment method, payment_status is set to `pending` on order creation | P0 |
| PAY-REQ-10 | Admin endpoint to confirm cash payment: `PATCH /api/admin/orders/:id/payment/confirm` → order status → `confirmed`, payment_status → `paid` | P0 |
| PAY-REQ-11 | Webhook idempotency: duplicate notifications do not double-process | P0 |
| PAY-REQ-12 | Payment status is visible in order detail response | P0 |
| PAY-REQ-13 | Mercado Pago access token is loaded from config (never hardcoded) | P0 |

### Ports

```go
// PaymentService (output port wrapping Mercado Pago SDK)
type PaymentService interface {
    CreatePreference(ctx context.Context, order *Order) (*PaymentPreference, error)
    ProcessWebhook(ctx context.Context, notification PaymentNotification) error
}

type PaymentPreference struct {
    PreferenceID string `json:"preference_id"`
    InitPoint    string `json:"init_point"`
}

type PaymentNotification struct {
    ID        string `json:"id"`
    Topic     string `json:"topic"`     // "payment" | "merchant_order"
    Action    string `json:"action"`    // "payment.created", "payment.updated"
    DataID    string `json:"data_id"`
    Timestamp time.Time `json:"timestamp"`
}
```

### Scenarios

```gherkin
Scenario: Create Mercado Pago preference on order placement
  Given I am an authenticated student
  And my cart has valid items
  When I POST `/api/orders` with `{"payment_method": "mercadopago"}`
  Then the response status is 201
  And the order includes `payment_preference` with `init_point` URL (https://www.mercadopago.com.ar/checkout/v1/...)
  And the order's `payment_status` is "pending"
  And the preference is stored in Mercado Pago (verified via MP API)

Scenario: Cash order does not create MP preference
  When I POST `/api/orders` with `{"payment_method": "cash"}`
  Then the response status is 201
  And the response does NOT contain `init_point`
  And the order's `payment_status` is "pending"
  And `payment_method` is "cash"

Scenario: Webhook receives approved payment
  Given order "ord-123" has payment_method "mercadopago" and payment_status "pending"
  When Mercado Pago sends a POST to `/api/mercadopago/webhook` with topic "payment" and action "payment.updated" indicating payment approved for order "ord-123"
  Then the webhook responds with 200
  And order "ord-123" now has payment_status "paid" and status "confirmed"

Scenario: Webhook receives failed payment
  Given order "ord-123" has payment_status "pending"
  When Mercado Pago sends a webhook notification indicating payment failed for order "ord-123"
  Then order "ord-123" now has payment_status "failed"
  And the order status remains "pending" (so admin can retry)

Scenario: Duplicate webhook notification is idempotent
  Given order "ord-123" already has payment_status "paid"
  When Mercado Pago sends the same "payment.approved" webhook again
  Then the webhook responds with 200
  And order "ord-123" still has payment_status "paid" (no double-processing)

Scenario: Admin confirms cash payment
  Given order "ord-456" has payment_method "cash" and payment_status "pending"
  When I PATCH `/api/admin/orders/ord-456/payment/confirm` as admin
  Then the response status is 200
  And order "ord-456" has payment_status "paid" and status "confirmed"

Scenario: Webhook without valid signature is rejected
  Given a malicious request with spoofed webhook payload
  When POST to `/api/mercadopago/webhook` without valid Mercado Pago IPN signature
  Then the response status is 400 (Bad Request)
  And no order status is modified

Scenario: MP preference for order with zero total
  Given my cart only contains items whose price is 0
  When I POST `/api/orders` with `{"payment_method": "mercadopago"}`
  Then the response status is 400
  And the error indicates that MP payment requires a non-zero total
```

### Acceptance Criteria

- Mercado Pago Checkout Pro integration creates valid preferences (test with sandbox)
- Webhook processes `payment.approved` → order confirmed + payment marked paid
- Webhook idempotent: replaying the same notification is safe
- Cash payment follows the admin confirmation flow
- Invalid webhook payloads are rejected
- Payment status is reflected in order detail responses

### Non-Functional

| Aspect | Constraint |
|---|---|
| Idempotency | Keyed by webhook notification ID + order ID (upsert in payment_events table) |
| MP API timeout | 10 seconds for preference creation |
| Webhook response | Always return 200 (MP will retry on non-200). Process asynchronously. |
| Security | Validate MP IPN origin via `x-signature` header or topic-based verification |
| Sandbox mode | Must work with MP Sandbox credentials for development/testing |
| Payment events log | All webhook events are persisted to a `payment_events` table for audit trail |

---

## Cross-Cutting Concerns

### Error Response Format (All Endpoints)

```json
{
  "error": {
    "code": "ERR_001",
    "message": "Human-readable description",
    "details": {}  // optional, field-level validation errors
  }
}
```

Error code prefix convention:
| Prefix | Module |
|---|---|
| AUTH | Auth module |
| CAT | Catalog module |
| CART | Cart module |
| ORD | Order module |
| PAY | Payment module |
| INF | Infrastructure |

### API Security

- All endpoints except `/api/health`, `/api/auth/register`, `/api/auth/login`, and `/api/mercadopago/webhook` require JWT authentication
- Admin endpoints (`/api/admin/*`) additionally require admin role check
- Orders endpoint filters by `student_id` from JWT claims (never trust client-provided student_id)
- Cart endpoints scope by authenticated student
- Rate limiting on auth endpoints (see AUTH non-functional)
- CORS: restrict to known origins in production

### Database Migrations

All tables should be created in a single initial migration (`001_init.sql`):

```sql
-- Students
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    course_id UUID NOT NULL REFERENCES courses(id),
    is_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Courses
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Divisions
CREATE TABLE divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(course_id, code)
);

-- Booklets
CREATE TABLE booklets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    course_id UUID NOT NULL REFERENCES courses(id),
    division_id UUID NOT NULL REFERENCES divisions(id),
    type VARCHAR(10) NOT NULL CHECK (type IN ('bw', 'color')),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    cover_image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Carts
CREATE TABLE carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID UNIQUE NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cart Items
CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    booklet_id UUID NOT NULL REFERENCES booklets(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(cart_id, booklet_id)
);

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','in_progress','ready','delivered','cancelled')),
    total DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash','mercadopago')),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
    mp_preference_id VARCHAR(255),
    mp_init_point TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Order Items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    booklet_id UUID NOT NULL REFERENCES booklets(id),
    title VARCHAR(255) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- Payment Events (audit trail)
CREATE TABLE payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    topic VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Transaction Boundaries

| Operation | Isolation Level | Involved Tables |
|---|---|---|
| Place order | Serializable | cart_items, carts, orders, order_items, booklets (stock decrement) |
| Cancel order | Repeatable Read | orders, order_items, booklets (stock restore) |
| Add to cart | Read Committed | cart_items, carts, booklets (stock check) |
| Update cart item | Read Committed | cart_items, booklets (stock check) |
| Confirm payment | Read Committed | orders, payment_events |

### Pagination Response Format (consistent across all list endpoints)

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 57,
    "total_pages": 3
  }
}
```

---

## Implementation Sequencing Notes

1. **Slice 1** must be completed first — everything depends on it
2. **Slice 2** depends on Slice 1 (needs config, DB pool, Fiber setup, migration with students table)
3. **Slice 3** depends on Slice 2 (needs auth middleware for admin endpoints)
4. **Slice 4** depends on Slice 3 (needs booklets to exist) and Slice 2 (auth)
5. **Slice 5** depends on Slice 4 (needs cart) and Slice 3 (needs booklets with stock)
6. **Slice 6** depends on Slice 5 (needs orders) and Slice 1 (config for MP token)

The slices are designed as a dependency chain. Each PR builds on the previous one and is merged into the main branch.
