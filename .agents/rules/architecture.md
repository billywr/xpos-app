---
description: XPOS backend module layout, domain model, and patterns
---

# XPOS Backend Architecture

Hard constraints and workflow live in `project.md` and `AGENTS.md`.

## Build & Test Commands

```bash
./mvnw spotless:apply              # Google Java Format
./mvnw clean compile               # MapStruct + Lombok
./mvnw checkstyle:check
./mvnw test                        # unit only (integration excluded)
./mvnw test -Psurefire-integration # full suite (Docker required)
./mvnw test -Dtest=SaleServiceTest
./mvnw test -Dtest=SaleServiceTest#shouldCreateSale
./mvnw spring-boot:run
docker compose up -d
```

After every change: spotless → compile → checkstyle → test → `-Psurefire-integration`.

## Module Layout

Base: `src/main/java/com/blinc/xpos/modules/`

| Module | Domain |
|--------|--------|
| sales | Sale, SaleLine, Tender, Receipt, Tab, OrderTicket, TableArea |
| cash | Shift, DayClose, CashMovement, MiscExpense, ZReport, ReceiptSequence |
| catalog | Item, Uom, VatCategory |
| pricing | Pricing rules, promotions |
| inventory | StockTaking, StockCountSession, StandardStockCountSnapshot |
| organization | Org, Branch, Terminal, StaffUser, Customer, Business, DeviceRegistration |
| compliance | TaxAgencyConfig, VscuConfig, EtimsInvoiceRecord |
| fraud | ApprovalPolicy, ApprovalEvent, ReasonCode, TheoreticalConsumptionSnapshot |
| ledger | LedgerAccount, LedgerEntry, LedgerPosting, PostingRule |
| debt | Customer debt |
| reporting | BI reports, PDF (OpenPDF) |
| auditvault | Audit trail, hash-chain verification |

**Layers:** `domain/` → `repository/` → `service/` → `service/impl/` → `mapper/`

**Controllers:** `api/v1/admin/{module}/`, `api/v1/pos/`, `api/v1/me/`

## Domain Relationships

- **Sale:** Sale → SaleLines, Tenders, Receipt; belongs to Shift → Terminal + StaffUser.
- **Cash:** Shift float → sales → close → variance; DayClose per branch/date; CashMovement + MiscExpense.
- **Ledger:** PostingRule auto-posts SALE/TENDER/STOCK_MOVEMENT to LedgerAccount.

## Key Patterns

- **Outbox** (`common/outbox/`): writes create `OutboxEvent` (PENDING) → `OutboxKafkaConsumer` → Kafka `xpos-outbox-events`.
- **Security:** OAuth2 resource server; `CurrentPrincipal` from JWT; `@PreAuthorize`; public: `/api/v1/health/**`, `/actuator/health/**`, `/uploads/**`.
- **Tracing:** `RequestIdFilter` + MDC for `X-Request-Id`.
- **Paging:** `PageRequestFactory` (default 25, max 200).
- **Errors:** `GlobalExceptionHandler`; `DatabaseErrorTranslator` + `ConstraintMessageCatalog`.

## Configuration

Profiles: `dev`, `prod`, `test`. Infra: PostgreSQL 16+, Kafka 3.9+, Keycloak 25+.

Custom props under `xpos.*`: upload dir, outbox, receipt, shift, inventory, offline sync, audit.

Migrations: `src/main/resources/db/migration/V*.sql` (Flyway only).

## Coding Standards

- Constructor injection, `private final`, `Objects.requireNonNull()`.
- `@Transactional` writes; `@Transactional(readOnly=true)` reads.
- Naming: singular entities; `{Entity}Service`/`ServiceImpl`, `{Entity}Repository`, `{Entity}AdminController`.
- DTOs in `{module}/dto/` as `{Entity}Request`/`{Entity}Response`; jakarta.validation.
- **Lombok:** `@Getter`/`@Setter` on entities (avoid `@Data` on JPA); `@Builder` on DTOs; `@Slf4j` for logging.
- **MapStruct:** `@Mapper(componentModel = "spring")` in `{module}/mapper/`; `@BeanMapping(nullValuePropertyMappingStrategy = IGNORE)` for patches.

## Testing

- Integration: extend `AbstractIntegrationTest`, `@Tag("integration")`, run with `-Psurefire-integration`.
- New endpoint group: happy path, 400 validation, org-scope 404/403, 409 duplicate.
- PriceListItem tests: createSupplier → createGrnForItem → addItemToPriceList (cost < price).
- Page JSON: `$.content.length()`, `$.content[0].field` — not root array.
