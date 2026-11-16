# E2E testing – endpoints and DB-level verification

This doc describes how to test **all endpoints end-to-end up to the database**, and what tests already exist.

---

## 1. Test setup (DB-level)

- **Base class:** `AbstractIntegrationTest` starts **PostgreSQL** via **Testcontainers** (real DB, no mocks).
- **HTTP:** Tests use **MockMvc** and mock JWT (`jwt().jwt(j -> j.subject("admin"))`), so every request goes through the full stack (controllers, services, repositories, DB).
- **Tag:** All these tests are tagged `integration` and are **excluded from default** `mvn test` (they need Docker).

### How to run integration tests

Surefire excludes the `integration` group by default (so `mvn test` does not need Docker). To run integration tests, activate the **surefire-integration** profile:

```bash
# Run all integration tests (requires Docker for Testcontainers)
mvn test -Psurefire-integration

# Run a single E2E test class
mvn test -Psurefire-integration -Dtest=E2EPostmanFlowIT
```

### Docker required

Integration tests require **Docker** (daemon running, API 1.44+). If Docker is not available when you run `mvn test -Psurefire-integration`, the build will **fail** with a clear error so you know the environment is wrong. Fix Docker or run without the profile (`mvn test`) to run only unit tests.

---

## 2. What tests exist today

### 2.1 Full flow (org → sale → receipt, with DB checks)

| Test class | What it does | DB-level check |
|------------|--------------|-----------------|
| **SaleOperatorControllerIT** | Org → business → branch → terminal → staff → assign → open shift → price list → item (with tax profile) → price list item → tender type → create sale → add line → add tender → complete → get receipt. | Optional test: after posting rules, asserts **ledger entries** via GET `/api/v1/admin/orgs/{orgId}/ledger-entries`. |

So you already have an E2E test that hits the DB and can assert on ledger data.

### 2.2 One test per controller (admin / operator)

Each of these runs against the real DB (Testcontainers) and exercises one controller group:

- **OrgAdminControllerIT**, **BranchAdminControllerIT**, **CustomerAdminControllerIT**
- **PrinterProfileAdminControllerIT**, **ReceiptTemplateAdminControllerIT**
- **CategoryAdminControllerIT**, **UomAdminControllerIT**, **ModifierGroupAdminControllerIT**, **ModifierOptionAdminControllerIT**, **ItemAdminControllerIT**
- **TaxProfileAdminControllerIT**, **PriceListAdminControllerIT**
- **ShiftAdminControllerIT**, **CashMovementAdminControllerIT**, **DayCloseAdminControllerIT**, **ZReportAdminControllerIT**
- **TenderTypeAdminControllerIT**
- **LedgerAccountAdminControllerIT**, **PostingRuleAdminControllerIT**, **LedgerEntryAdminControllerIT**
- **SupplierAdminControllerIT**, **PurchaseOrderAdminControllerIT**, **GoodsReceiptNoteAdminControllerIT**, **StockMovementAdminControllerIT**, **StockCountSessionAdminControllerIT**, **TransferOrderAdminControllerIT**, **RecipeAdminControllerIT**
- **TaxAgencyConfigAdminControllerIT**, **VscuConfigAdminControllerIT**, **EtimsInvoiceRecordAdminControllerIT**
- **ReasonCodeAdminControllerIT**, **ApprovalPolicyAdminControllerIT**, **ApprovalEventAdminControllerIT**
- **AuditLogAdminControllerIT**, **AuditVaultRecordAdminControllerIT**, **OutboxEventAdminControllerIT**
- **HealthControllerIT**

Together they cover **all** admin and operator endpoint groups end-to-end with the DB.

---

## 3. Tests you can add to “ensure all endpoints work E2E up to DB”

### 3.1 Single full E2E test (Postman flow)

Add one test class that runs the **exact** Postman flow in order:

1. **GET** `/api/v1/health/ping`
2. **POST** org → business → branch → terminal
3. **POST** device register → **POST** bind device
4. **POST** staff user → **PUT** profile → **POST** branch assignment
5. **POST** category → UoM → tax profile → item → (optional item UoM)
6. **POST** price list → price list item
7. **POST** tender type
8. **POST** open shift
9. **POST** create sale → **POST** add line (e.g. 1 bottle) → **POST** add tender → **POST** complete
10. **GET** receipt

Then add **DB-level checks**, for example:

- **GET** `/api/v1/admin/orgs/{orgId}/ledger-entries?branchId=...` and assert two entries (debit/credit) for the sale total, or
- **GET** `/api/v1/admin/orgs/{orgId}/branches/{branchId}/z-report?businessDate=...` and assert sale count / totals.

That gives you **one test** that ensures the whole chain works and that data is persisted correctly (ledger or Z-report read from DB).

Such a class is added as **`E2EPostmanFlowIT`** (see below).

### 3.2 Per-endpoint DB checks (optional)

For critical writes you can add, in existing ITs or in the full E2E test:

- After **create org**: GET org by id and assert name/status.
- After **create sale** + **complete**: GET ledger-entries (as in `SaleOperatorControllerIT`) or Z-report.
- After **day close**: GET day-close by id and assert status.

No new test types are strictly required if you already run the full E2E test and the existing controller ITs.

---

## 4. Summary

| Goal | What to run / add |
|------|-------------------|
| Run all endpoint tests against real DB | `mvn test -Psurefire-integration` |
| One test that runs full Postman flow + DB check | **E2EPostmanFlowIT** (full flow + ledger or Z-report assertion) |
| Per-controller E2E | Existing `*AdminControllerIT` and **SaleOperatorControllerIT** already do this |

---

## 5. New test: E2EPostmanFlowIT

The class **`E2EPostmanFlowIT`**:

- Runs the **entire** E2E flow (health → org → … → sale complete → receipt), including device register/bind, category, UoM, staff profile.
- Verifies **DB persistence** by calling an admin read endpoint that reads from the DB (e.g. ledger-entries or z-report) and asserting on the result.

Location: `src/test/java/com/blinc/xpos/api/v1/e2e/E2EPostmanFlowIT.java`.

Run it with:

```bash
mvn test -Psurefire-integration -Dtest=E2EPostmanFlowIT
```

---

## 6. Test coverage (JaCoCo)

**JaCoCo** is configured to collect coverage on every test run (unit and, when run, integration).

- **Collect coverage:** `mvn test` (and `mvn test -Psurefire-integration`) write execution data to `target/jacoco.exec`.
- **Generate report:** Run `mvn jacoco:report` after tests, or run `mvn verify` (report is generated in the `verify` phase).
- **View report:** Open `target/site/jacoco/index.html` in a browser.

Excluded from the report: main class (`XposApplication`), `config` package, and `dto` packages. The build enforces a minimum 75% instruction coverage (`mvn verify`). To reach 90%, add tests for more exception-handler paths, sale hold/void flows, Z-report paths, and low-coverage services.
