# XPOS Spring Boot Backend Agent Guidelines

You are working on **XPOS**: a production-grade multi-vertical POS for Kenya (supermarkets, retail shops, pubs/bars, restaurants, hotels).
This is a control + accounting system (anti-leakage, accountability, auditability), not just a cashier app.

---

## Tech Stack

- **Java 21**
- **Spring Boot 4.0+**
- **PostgreSQL**
- **Flyway Migrations Only** (no JPA auto-ddl)
- **Kafka Outbox Pattern**
- **Keycloak OAuth2 Resource Server (JWT)**

---

## Build & Test Commands

Run in order after every change:

```bash
./mvnw spotless:apply              # Google Java Format
./mvnw clean compile               # MapStruct + Lombok
./mvnw checkstyle:check            # Checkstyle compliance
./mvnw test                        # Unit tests only (integration excluded)
./mvnw test -Psurefire-integration # Full suite with integration tests (Docker required)
```

Run single test:
```bash
./mvnw test -Dtest=SaleServiceTest
./mvnw test -Dtest=SaleServiceTest#shouldCreateSale
```

---

## Non-Negotiable Hard Constraints

1. **Checkstyle Compliance is Mandatory**:
   - No tabs. 4-space indentation.
   - Newline at EOF.
   - Max line length 140 characters.
   - No wildcard/star imports.
   - No unused imports.
   - Naming rules apply to methods (camelCase only; no underscores).
   - Method length $\le$ 100 lines (split logically if needed).
   - Keep code formatting consistent with existing project style.

2. **Database is Defined ONLY via Flyway Migrations**:
   - Do not enable Hibernate schema generation.
   - All schema changes must be new Flyway migrations (append-only: `src/main/resources/db/migration/V*.sql`). Never edit old migrations.
   - Do not add `@GeneratedValue` strategies that conflict with DB defaults unless clearly required.

3. **Single Spring Boot Monolith**:
   - Modular packages (`src/main/java/com/blinc/xpos/modules/`).
   - Clean separation of domains.

4. **Keycloak is External IAM (Backend is Resource Server)**:
   - Do not implement login/auth flows in XPOS.
   - Always treat JWT `sub` as `iamUserId`.
   - Authorization is enforced in XPOS based on `staff_user` and branch assignments.
   - Operator endpoints (shift, cash, day close) resolve staff via `requireStaffUserForBranch(orgId, branchId, iamUserId)`.

5. **User-Facing Specific Error Handling**:
   - No generic "Unhandled error" unless truly unknown 500.
   - Validation errors must return field-level details.
   - Database constraint violations must translate to meaningful messages via `DatabaseErrorTranslator` + `ConstraintMessageCatalog`.
   - Always include `requestId` in error responses.

6. **Checkstyle-Safe Repository Query Methods**:
   - Do not use derived method names containing underscores (e.g. `findByOrg_Id` is invalid).
   - Use JPQL `@Query` with text blocks correctly: opening `"""` must be followed immediately by a newline.
   - Keep method names camelCase without underscores.

7. **No Vendor-Specific JDBC Usage in App Logic**:
   - Avoid `org.postgresql.util.PSQLException` usage.
   - Translate DB errors via `java.sql.SQLException` + SQLSTATE + safe parsing.

---

## Architecture Rules

- **Multi-Tenant Scoping**: Every admin and business operation must be scoped to `orgId`. Repositories must support `orgId` filtering. Services must validate org ownership.
- **Control System Invariants**: No transactions without valid linkage: $\text{org} \to \text{branch} \to \text{terminal} \to \text{device} \to \text{staff assignment}$.
- **Layers**: Controller $\to$ DTO $\to$ Service Interface $\to$ Service Implementation $\to$ Repository. Controllers are thin. Services hold `@Transactional` boundaries.
- **DTOs & LAZY Fetching**: Request/response DTOs for the API layer with `jakarta.validation`. When entities are mapped to DTOs in controllers and the mapping accesses LAZY associations (`org`, `branch`, `item`, `supplier`, etc.), ALWAYS add `LEFT JOIN FETCH` in repository JPQL queries to prevent `LazyInitializationException` (500).
- **Pagination**: List endpoints must use `Pageable` and clamp via `PageRequestFactory` (default 25, max 200). Never return unbounded lists.
- **MapStruct & Lombok**: Use MapStruct (`@Mapper(componentModel = "spring")`) in `mapper/`. Use `@Getter`/`@Setter` on entities (avoid `@Data` on JPA entities); `@Builder` on DTOs; `@Slf4j` for logging.
- **Outbox Pattern**: Writes emit `OutboxEvent` (PENDING) $\to$ Kafka topic `xpos-outbox-events`.

---

## Module Layout

Base package: `src/main/java/com/blinc/xpos/modules/`

| Module | Domain Models / Purpose |
| :--- | :--- |
| **`sales`** | Sale, SaleLine, Tender, Receipt, Tab, OrderTicket, TableArea |
| **`cash`** | Shift, DayClose, CashMovement, MiscExpense, ZReport, ReceiptSequence |
| **`catalog`** | Item, Uom, VatCategory |
| **`pricing`** | Pricing rules, promotions, PriceListItem |
| **`inventory`** | StockTaking, StockCountSession, StandardStockCountSnapshot |
| **`organization`** | Org, Branch, Terminal, StaffUser, Customer, Business, DeviceRegistration |
| **`compliance`** | TaxAgencyConfig, VscuConfig, EtimsInvoiceRecord |
| **`fraud`** | ApprovalPolicy, ApprovalEvent, ReasonCode, TheoreticalConsumptionSnapshot |
| **`ledger`** | LedgerAccount, LedgerEntry, LedgerPosting, PostingRule |
| **`debt`** | Customer debt (record, update, settle, cancel) |
| **`reporting`** | BI reports, PDF (OpenPDF) |
| **`auditvault`** | Audit trail, hash-chain verification |

---

## Change Checklist

Before concluding any backend change:
1. Schema changes in new append-only Flyway migration.
2. Code follows layer structure with DTOs and validation.
3. Repositories are org-scoped with `JOIN FETCH` for LAZY relationships.
4. Error responses contain code, message, and `requestId`.
5. Integration tests added/updated (`AbstractIntegrationTest`).
6. Run: `./mvnw spotless:apply && ./mvnw clean compile && ./mvnw checkstyle:check && ./mvnw test -Psurefire-integration`.
