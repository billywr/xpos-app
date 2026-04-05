# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
# Compile (runs MapStruct + Lombok annotation processors)
./mvnw clean compile

# Unit tests only (integration tests excluded by default)
./mvnw test

# Unit + integration tests (requires Docker for Testcontainers)
./mvnw test -Psurefire-integration

# Run a single test class
./mvnw test -Dtest=SaleServiceTest

# Run a single test method
./mvnw test -Dtest=SaleServiceTest#shouldCreateSale

# Auto-format code (Google Java Format, 2-space indents)
./mvnw spotless:apply

# Check formatting without fixing
./mvnw spotless:check

# Checkstyle validation
./mvnw checkstyle:check

# Build JAR
./mvnw clean package -DskipTests

# Run locally (requires PostgreSQL, Redis, Keycloak on default ports)
./mvnw spring-boot:run

# Full stack via Docker
docker compose up -d
```

## Hard Constraints

1. **Checkstyle is mandatory.** No tabs, 4-space indentation, newline at EOF, max 140 char lines, no wildcard/star imports, no unused imports, camelCase method names (no underscores), method length <= 100 lines.
2. **Database via Flyway only.** Do not enable Hibernate schema generation. All schema changes must be new Flyway migrations (append-only). Never edit old migrations.
3. **Single monolith.** One Spring Boot service, modular packages. No microservices.
4. **Keycloak is external IAM.** Do not implement login/auth flows in XPOS. Always treat JWT `sub` as `iamUserId`. Authorization enforced based on `staff_user` and assignments. Operator endpoints resolve current staff via `requireStaffUserForBranch(orgId, branchId, iamUserId)`.
5. **Error handling must be user-facing and specific.** Validation errors return field-level details. DB constraint violations translate to meaningful messages. Always include `requestId` in error responses.
6. **Repository query methods must be Checkstyle-safe.** No derived method names with underscores (e.g., `findByOrg_Id`). Use JPQL `@Query` with text blocks (opening `"""` must be followed by a newline). Keep method names camelCase.
7. **No vendor-specific JDBC in app logic.** Avoid `org.postgresql.util.PSQLException`. Translate DB errors via `java.sql.SQLException` + SQLSTATE.

## Architecture

### Module Layout

The app is a multi-tenant POS system under `src/main/java/com/blinc/xpos/`. Domain modules live in `modules/`:

- **sales** — Sale aggregate (Sale → SaleLine, Tender, Receipt), Tab, OrderTicket, TableArea
- **cash** — Shift, DayClose, CashMovement, MiscExpense, ZReport, ReceiptSequence
- **catalog** — Item, Uom, VatCategory
- **pricing** — Pricing rules, promotions
- **inventory** — StockTaking, StockCountSession, StandardStockCountSnapshot
- **organization** — Org, Branch, Terminal, StaffUser, Customer, Business, DeviceRegistration
- **compliance** — TaxAgencyConfig, VscuConfig, EtimsInvoiceRecord (Kenya eTIMS tax integration)
- **fraud** — ApprovalPolicy, ApprovalEvent, ReasonCode, TheoreticalConsumptionSnapshot
- **ledger** — LedgerAccount, LedgerEntry, LedgerPosting, PostingRule (auto-posting from sales/stock)
- **debt** — Customer debt tracking
- **reporting** — BI reports, PDF generation (OpenPDF)
- **auditvault** — Audit trail with hash-chain verification

### Layering Convention

Each module follows: `domain/` (JPA entities) → `repository/` (Spring Data JPA) → `service/` (interface) → `service/impl/` (implementation) → `mapper/` (MapStruct, some still placeholder).

REST controllers live in `api/v1/`:
- `api/v1/admin/{module}/` — admin/back-office endpoints
- `api/v1/pos/` — POS-facing terminal endpoints
- `api/v1/me/` — authenticated user's own profile

### Multi-Tenant Hierarchy

`Org` → `Branch` → `Terminal`. All entities carry `org_id` FK. Staff are assigned to branches via `StaffBranchAssignment`. Terminals bind to physical devices via `DeviceRegistration`.

**Org scoping is mandatory:** Every admin and business operation must be org-scoped. Repositories must support `orgId` filtering. Services must validate org ownership (no cross-org access).

**Control system behavior:** No transactions without valid org → branch → terminal → device → staff assignment (as applicable). Shift control, blind close, approvals, audit chain are enforced.

### Key Domain Relationships

**Sale aggregate:** Sale (root) has N SaleLines, N Tenders, 1 Receipt. Sale belongs to a Shift, which belongs to a Terminal+StaffUser. SaleLine references Item from catalog.

**Cash flow:** Shift tracks opening float → sales → closing count → variance. DayClose aggregates all shifts for a branch on a business date. CashMovement and MiscExpense record non-sale cash activity.

**Ledger:** PostingRule maps source events (SALE, TENDER, STOCK_MOVEMENT) to debit/credit entries in LedgerAccount automatically.

### Key Patterns

**Outbox pattern** (`common/outbox/`): Write operations create `OutboxEvent` rows (PENDING). A scheduled `OutboxKafkaConsumer` polls and publishes to Kafka topic `xpos-outbox-events` in batches, updating status to ACKED/FAILED. `SyncPriorityQueue` orders events for offline sync scenarios. Consumer is conditional on KafkaTemplate bean presence.

**Security:** OAuth2 Resource Server with Keycloak JWT validation. `CurrentPrincipal` record (iamUserId, subject, username, roles) resolved from `JwtAuthenticationToken` via `CurrentPrincipalResolver`. Method-level auth via `@PreAuthorize`. Public endpoints: `/api/v1/health/**`, `/actuator/health/**`, `/uploads/**`.

**Request tracing:** `RequestIdFilter` extracts/generates `X-Request-Id`, sets MDC for structured logging.

**Pagination:** `PageRequestFactory` in `common/web/paging/` with configurable defaults (25/page, max 200).

**Error handling:** Custom exceptions (`NotFoundException`, `ConflictException`, `BadRequestException`, `ApiException`) caught by `GlobalExceptionHandler`. `DatabaseErrorTranslator` maps constraint violations to user-friendly messages via `ConstraintMessageCatalog`.

## Configuration

**Profiles:** `dev` (localhost services), `prod` (env vars), `test` (Testcontainers override).

**Infrastructure:** PostgreSQL 16+, Redis 7+, Kafka 3.9+, Keycloak 25+.

**Custom properties** under `xpos.*` namespace: upload dir, outbox (topic, poll interval, batch size), receipt (block size, prefix), shift (blind close, variance threshold), inventory (negative stock, auto-post consumption), offline sync, audit (hash algorithm, chain verification).

**Database migrations:** Flyway, auto-run on startup. Migration files in `src/main/resources/db/migration/V*.sql`.

## Coding Standards

- **Formatting:** Google Java Format (enforced by Spotless), max 140 char lines (Checkstyle), no star imports, max 100-line methods
- **DI:** Constructor injection only, final fields, `Objects.requireNonNull()` for null checks
- **Transactions:** `@Transactional` for writes, `@Transactional(readOnly=true)` for reads
- **Naming:** Singular entity names (Sale not Sales), `{Entity}Service`/`{Entity}ServiceImpl`, `{Entity}Repository`, `{Entity}AdminController` for admin endpoints
- **DTOs:** In `{module}/dto/`, named `{Entity}Request`, `{Entity}Response`. Validate using `jakarta.validation`. Never expose internal entity graphs. When mapping entities to DTOs that access LAZY associations, add `JOIN FETCH` in repository queries to avoid `LazyInitializationException`.
- **Error codes:** Use UPPER_SNAKE_CASE error codes with user-facing messages suitable for POS operators.
- **Lombok:** Use Lombok annotations where appropriate — `@Getter`, `@Setter`, `@Builder`, `@NoArgsConstructor`, `@AllArgsConstructor`, `@RequiredArgsConstructor`, `@ToString`, `@EqualsAndHashCode` on entities and DTOs. Use `@Slf4j` for logging. Prefer `@Builder` for DTOs with many fields. Use `@Data` sparingly (prefer explicit `@Getter`/`@Setter` on entities to avoid JPA pitfalls with `equals`/`hashCode`).
- **MapStruct:** Use MapStruct for entity↔DTO mapping in `{module}/mapper/` package. Mapper interfaces annotated with `@Mapper(componentModel = "spring")`. Use `@Mapping` for field name mismatches. Inject mappers via constructor injection like any other Spring bean. Prefer single `toResponse`/`toEntity` method naming. Use `@BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)` for partial update mappings.

## Testing

- **Unit tests** run by default; integration tests require `-Psurefire-integration` or `-Dsurefire.excludedGroups=`
- **Integration tests** extend `AbstractIntegrationTest` (Testcontainers: PostgreSQL 16-alpine, Redis 7-alpine), tagged `@Tag("integration")`
- **JaCoCo** enforces 75% instruction coverage; excludes: `XposApplication`, `config/**`, `dto/**`, `outbox/consumer/**`
- **Clock:** Mock `Clock` bean available for deterministic time-dependent tests
- **Required test coverage per new endpoint group:** (a) happy-path integration test, (b) validation failure (400) with field details, (c) org-scoping test (404/403 for other org's records), (d) duplicate/constraint test (409) with user-friendly message
- **PriceListItem tests:** Must first `createSupplier(orgId)`, then `createGrnForItem(orgId, branchId, supplierId, itemId)`, then `addItemToPriceList`. Use unit cost lower than selling price (e.g., 40–80 vs 99.50).
- **Page list endpoints:** JSON has `content` array. In tests use `$.content.length()` not `$.length()`; `$.content[0].field` not `$[0].field`.

## API Standards

- Use `/api/v1` prefix. Admin endpoints under `/api/v1/admin`.
- Include `orgId` scoping consistently. Prefer path variable for admin resources.
- Response errors must include: `code`, `message` (user-facing), `requestId`, `details` (optional).
- HTTP status codes: 409 conflicts, 404 missing, 400 validation, 403 forbidden, 401 auth.

## Common Gotchas

- Do not use `@Query("""select ...""")` without newline after opening `"""`.
- Do not import `MethodArgumentTypeMismatchException` from `org.springframework.web.bind` — use `org.springframework.web.method.annotation.MethodArgumentTypeMismatchException`.
- Do not construct `ApiErrorDetail` with wrong arity. Check record signature.
- Do not introduce orgId traversal underscores in repository method names.
- Do not allow Springdoc/OpenAPI dependencies that create Boot auto-config conflicts unless isolated to dev-only.

## Workflow for Changes

After every change, verify in order:
1. `./mvnw spotless:apply` — format code
2. `./mvnw clean compile` — compile
3. `./mvnw checkstyle:check` — checkstyle validation
4. `./mvnw test` — unit tests
5. `./mvnw test -Psurefire-integration` — full integration tests (Docker required)

**Before committing:** Code compiles, checkstyle passes, all tests pass, error messages are specific, org scoping enforced, DB constraints mapped to friendly messages, JOIN FETCH added for LAZY associations in response mappings.

## Related Documentation

- `docs/E2E_FULL_API_REFERENCE.md` — full API surface
- `docs/IMPLEMENTATION_PLAN.md` — backend phased plan
- `docs/STOCK_TAKING_IMPLEMENTATION.md` — stock taking flows
- `docs/FRONTEND_IMPLEMENTATION.md` — frontend guide
- `docs/TROUBLESHOOTING.md` — common issues and solutions
- `docs/E2E_POSTMAN_GUIDE.md` — Postman E2E testing flow
