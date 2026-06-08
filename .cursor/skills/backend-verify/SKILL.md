---
name: xpos-backend-verify
description: XPOS backend verification workflow — Spotless, Checkstyle, unit and integration tests. Use after Java/API changes in xpos.
---

# XPOS Backend Verification

Run in order after every change:

```bash
./mvnw spotless:apply
./mvnw clean compile
./mvnw checkstyle:check
./mvnw test
./mvnw test -Psurefire-integration   # Docker required
```

Single test: `./mvnw test -Dtest=SaleServiceTest#shouldCreateSale`

## New API Checklist

1. Flyway migration if schema changed (append-only, never edit old migrations).
2. Controller → DTO → Service interface → ServiceImpl → Repository.
3. Org-scoped queries; JOIN FETCH for LAZY associations used in response mapping.
4. Integration test: happy path, 400 validation, org-scope 404/403, 409 duplicate.
5. User-facing error codes (UPPER_SNAKE_CASE) + requestId.

## PriceListItem Tests

Must chain: `createSupplier` → `createGrnForItem` → `addItemToPriceList` (GRN unit cost < selling price).

## Page JSON in Tests

Use `$.content.length()` and `$.content[0].field` — not root array paths.
