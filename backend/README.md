# Foto App — Backend

Node.js + Express + Prisma API.

## Stack

- **Runtime:** Node.js 24+
- **Framework:** Express 4
- **ORM:** Prisma 6 (PostgreSQL)
- **Auth:** JWT (jsonwebtoken + bcrypt)
- **Payments:** Mercado Pago

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Iniciar servidor con watch |
| `npm run test` | Ejecutar tests (una vez) |
| `npm run test:watch` | Ejecutar tests en watch mode |
| `npm run db:migrate` | Correr migraciones de Prisma |
| `npm run db:seed` | Sembrar datos de prueba |
| `npm run db:studio` | Abrir Prisma Studio |

## Tests

Los tests son **integración** contra PostgreSQL real. Usan `vitest` + `supertest`.

### Configuración

- `vitest.config.js` — configuración de vitest, modo secuencial (`fileParallelism: false`) para evitar conflictos entre suites
- `tests/helpers.js` — helpers de Prisma (crear usuarios, cuadernillos, cleanup)
- `tests/setup.js` — setup global (fallback de variables de entorno)

### Suites

| Archivo | Tests | Cobertura |
|---------|-------|-----------|
| `tests/auth.test.js` | 10 | registro, login, rutas protegidas, rutas admin |
| `tests/catalog.test.js` | 16 | catálogo público + CRUD admin de divisiones y cuadernillos |
| `tests/orders.test.js` | 17 | carrito, ordenes, flujo admin (búsqueda, estado, cancelación) |

**Total: 43 tests.**

### Ejecutar

```bash
cd backend
npm test
```

Requiere `DATABASE_URL` en `.env` apuntando a una base PostgreSQL con las tablas migradas.
