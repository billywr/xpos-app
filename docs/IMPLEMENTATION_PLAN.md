# xpos – Phased Implementation Plan

This doc outlines how to **complete the xpos backend in phases** so each phase is shippable, testable, and not chaotic. Implementation and acceptance criteria **align with** the following:

- **[PRD_DOC.md](PRD_DOC.md)** – Product Requirements Document (multi-vertical POS, audit vault, sub-ledger, blind close, eTIMS, offline, etc.).
- **[FRD_DOC.md](FRD_DOC.md)** – Functional Requirements Document (actors, sales, inventory, shift/cash, audit & ledger, hospitality, compliance, offline, reporting).

Use the PRD/FRD for product goals, workflows, and acceptance criteria; use this plan for phased delivery order and technical scope.

---

**Current state (Phases 1–9 done):**

- **Done (full API + services + entities + repos):** Organization, Catalog, Pricing, Cash/till, Sales, Inventory, Ledger & reporting, Compliance & fraud, Audit & outbox (audit log, audit vault, outbox events).
- **Remaining:** Optional follow-ups (LedgerPostingService, wire eTIMS/approvals into sales, outbox consumer).

Each phase adds **services + API (and tests)** for one domain, following the same patterns as the organization module.

---

## Phase 1 – Foundation ✓ (already done)

- **Scope:** Orgs, branches, businesses, terminals, device registration, staff users/profiles/assignments, `/api/v1/me`, health.
- **Deliverable:** Admin can manage tenant hierarchy and staff; devices can register; users can call `/api/v1/me`.
- **Status:** Implemented.

---

## Phase 2 – Catalog & reference data ✓

**Goal:** “What we sell” – categories, UoMs, items (with barcodes, UoMs, modifier groups, images), and tax profiles. All **admin** APIs, scoped by org (and optionally branch).

**Add:**

- **Services:** `CategoryService`, `UomService`, `TaxProfileService` (org-level), `ItemService` (with barcode/UoM/modifier/image handling), `ModifierGroupService`, `ModifierOptionService` (if exposed).
- **Controllers:** e.g. `CategoryAdminController`, `UomAdminController`, `TaxProfileAdminController`, `ItemAdminController` under `/api/v1/admin/orgs/{orgId}/...` (and branches if you scope catalog per branch).
- **DTOs:** Create/Update/Response for each resource; reuse existing entities and repos.
- **Tests:** Service unit tests + one integration test per controller (or key flows).

**Status:** Implemented (TaxProfile, Category, UoM, ModifierGroup, ModifierOption, Item + ItemBarcode, ItemUom, ItemModifierGroup, ItemImage).

---

## Phase 3 – Pricing ✓

**Goal:** Price lists, price list items, price schedules, scheduled prices, promotion rules. Admin APIs, org (and optionally branch) scoped.

**Add:**

- **Services:** `PriceListService`, `PriceListItemService`, `PriceScheduleService`, `ScheduledPriceService`, `PromotionRuleService`.
- **Controllers:** e.g. `PriceListAdminController`, `PriceScheduleAdminController`, `PromotionRuleAdminController` under `/api/v1/admin/orgs/{orgId}/...`.
- **DTOs + tests** as in Phase 2.

**Depends on:** Phase 2 (items, tax profiles). Can start with price list + price list items only, then add schedules and promotions.

**Status:** Implemented.

---

## Phase 4 – Cash / till (shifts & day close) ✓

**Goal:** Till lifecycle – open/close shift, denomination counts, cash movements (pay-in/pay-out, petty cash, float), day close, receipt sequences (and block allocation if needed). **Operator** APIs for terminal/branch (e.g. open/close shift, record movement) plus optional **admin** read/report APIs.

**Add:**

- **Services:** `ShiftService`, `CashMovementService`, `DayCloseService`, `ReceiptSequenceService` (and `ReceiptBlockAllocationService` if you use block allocation).
- **Controllers:**
  - Operator: e.g. `/api/v1/operator/orgs/{orgId}/branches/{branchId}/terminals/{terminalId}/shifts` (open, close, get current), `.../cash-movements` (create), `.../day-close` (close day).
  - Admin (optional): list shifts, list cash movements, list day closes for reporting.
- **DTOs + tests.** Enforce rules in service (e.g. one open shift per terminal, day close only when shifts closed).

**Depends on:** Phase 1 (terminals, branches). Schema and entities/repos already exist.

**Status:** Implemented (operator + admin read APIs; ReceiptSequenceService.getNextNumber for Phase 5).

---

## Phase 5 – Sales (core POS) ✓

**Goal:** Create/update/hold/complete/void sales, sale lines (with modifiers), taxes, discounts, tenders, receipts. Operator APIs at terminal/branch; admin read/void/refund if needed.

**Add:**

- **Services:** `SaleService` (create, add line, hold, complete, void, refund), `TenderService`, `ReceiptService`; integrate with catalog (items, prices) and cash (shift, receipt sequence).
- **Controllers:** e.g. `/api/v1/operator/.../sales` (create, get, list open/held, add line, tender, complete), `/api/v1/operator/.../receipts` (get by sale).
- **DTOs + tests.** Start with minimal flow: create sale → add lines → add tenders → complete → receipt. Then add hold, void, refund, discounts, taxes.

**Depends on:** Phase 2 (catalog), Phase 3 (pricing), Phase 4 (shift for terminal). Optionally tables/tabs (Phase 5b) and order tickets (kitchen/bar) later.

**Status:** Implemented. SaleService (create, addLine, hold, complete, void), TenderService, ReceiptService; operator Sales + receipt-by-sale; price resolution from price list; SaleOperatorControllerIT. Tax/discount/refund left for later.

---

## Phase 6 – Inventory (optional for MVP)

**Goal:** Suppliers, purchase orders, GRNs, stock movements, stock count, transfers, recipes. Admin (and maybe operator for receiving/count). Can be split into 6a (suppliers, PO, GRN, stock movement) and 6b (stock count, transfer, recipe).

**Add:**

- **Services:** `SupplierService`, `PurchaseOrderService`, `GoodsReceiptNoteService`, `StockMovementService`, `StockCountSessionService`, `TransferOrderService`, `RecipeService` (and related line services).
- **Controllers:** Admin under `/api/v1/admin/orgs/{orgId}/branches/{branchId}/...` (or org-level where applicable).
- **DTOs + tests.** Integrate with catalog (items) and, if needed, ledger (Phase 7).

**Depends on:** Phase 2 (catalog). Ledger optional.

**Status:** Phase 6 complete. 6a: SupplierService, PurchaseOrderService (+ lines), GoodsReceiptNoteService (create GRN with lines, creates StockMovement IN per line), StockMovementService (read/list). Admin controllers: suppliers, purchase-orders, goods-receipt-notes, stock-movements. 6b: StockCountSessionService (start, add line, close), TransferOrderService (+ lines), RecipeService (+ lines, update). Admin controllers: stock-count-sessions, transfer-orders, recipes. Integration tests for all seven controller groups.

---

## Phase 7 – Ledger & reporting (incremental) ✓

**Goal:** Ledger accounts, posting rules, ledger entries (often written by sales/cash/inventory services); Z-reports, day-close reports. Mostly internal service usage + admin/read APIs.

**Add:**

- **Services:** `LedgerAccountService`, `PostingRuleService`; ensure sales/cash (and optionally inventory) post entries via these or a small `LedgerPostingService`.
- **Controllers:** Admin APIs to list accounts, list entries, get Z-report, day-close summary.
- **Reporting module:** Implement reporting package (currently empty) with report DTOs and services that read from existing repos (sales, cash, ledger).

**Depends on:** Phase 4 (cash), Phase 5 (sales). Can start with read-only reporting and add posting rules incrementally.

**Status:** Implemented. LedgerAccountService (create, require, requireByCode, list), PostingRuleService (create, require, list), LedgerEntryService (require, list, listByBranch, listByBranchAndDate). Org-scoped repos for ledger_account, posting_rule, ledger_entry. Admin controllers: ledger-accounts, posting-rules, ledger-entries. ZReportService (getZReport from completed sales/tenders for branch+date). ZReportAdminController GET .../z-report?businessDate=; DayCloseAdminController extended with GET .../day-closes/{dayCloseId}. Reporting package: reporting.dto.ZReportSummaryResponse, reporting.service.ZReportService. Integration tests for all four ledger/report controller groups.

**Phase 7 follow-up (done):** Sales and cash already post ledger entries via `LedgerPostingService` on sale complete and cash movement.

---

## Phase 8 – Compliance & fraud (incremental) ✓

**Goal:** ETIMS integration (submit invoice, status), tax agency config, VSCU config; approval policies/events and reason codes for voids/refunds/discounts.

**Add:**

- **Services:** `EtimsInvoiceRecordService` (submit, poll status), `TaxAgencyConfigService`, `VscuConfigService`; `ApprovalPolicyService`, `ApprovalEventService`, `ReasonCodeService`.
- **Controllers:** Admin for config and reason codes; operator or background for approval requests; compliance endpoints for ETIMS/VSCU as needed.
- **Integration:** Call approval/fraud checks from Phase 5 (void, refund, discount) and compliance from receipt/sale completion.

**Depends on:** Phase 5 (sales). Can be weaved in when implementing void/refund/discount flows.

**Status:** Implemented. ReasonCodeService (create, require, list, update). TaxAgencyConfigService (create, require, list, update). VscuConfigService (create, require, findByBranch, list, update). ApprovalPolicyService (create, require, list). ApprovalEventService (create, require, listByBranch). EtimsInvoiceRecordService (create, require, listByBranch, submit stub, pollStatus stub). Org/branch-scoped repos for all. Admin controllers: reason-codes, tax-agency-configs, vscu-configs, approval-policies, approval-events, etims-invoice-records (branch-scoped). Integration tests for ReasonCode and TaxAgencyConfig. Wiring void/refund/discount to approval and sale-complete to eTIMS record creation left for later.

---

## Phase 9 – Audit & outbox (incremental) ✓

**Goal:** Audit vault and audit log usage; outbox event publishing (and optionally sync priority queue). Often used by existing or new services rather than many new endpoints.

**Add:**

- **Services:** Use `AuditVaultRecord` / `AuditLog` in critical flows (e.g. sale complete, day close, void); ensure outbox events are written and processed (if Kafka or similar is used).
- **Controllers:** Admin read-only for audit log / vault if required.
- **No new domains:** Just wiring and policies (what to audit, what to publish).

**Depends on:** Phase 5, 4, 6 as you add auditing to those flows.

**Status:** Implemented. AuditLogService (append, require, list, listByBranch). AuditVaultRecordService (append with hash chain, require, list, listByBranch). OutboxEventService (enqueue, require, list, updateStatus). Org-scoped repos for audit_log, audit_vault_record, outbox_event. Admin read-only: audit-logs, audit-vault-records, outbox-events. SaleServiceImpl: audit log appended on complete and void. DayCloseServiceImpl: audit log appended on closeDay. Integration test AuditLogAdminControllerIT. **Outbox consumer:** OutboxKafkaConsumer (scheduled) polls PENDING events, publishes to Kafka, updates status to ACKED on success or FAILED on failure; conditional on KafkaTemplate bean.

---

## Suggested execution order

| Order | Phase   | Focus                    | Delivers                                 | Status   |
|-------|--------|---------------------------|------------------------------------------|----------|
| 1     | Done   | Organization              | Tenant + staff + devices                 | ✓        |
| 2     | Done   | Catalog & reference       | Categories, UoMs, items, tax profiles    | ✓        |
| 3     | Done   | Pricing                   | Price lists, schedules, promotions      | ✓        |
| 4     | Done   | Cash / till               | Shifts, cash movements, day close       | ✓        |
| 5     | Done   | Sales                     | Sales, tenders, receipts                 | ✓        |
| 6     | Done   | Inventory                 | PO, GRN, stock, stock count, transfers, recipes   | ✓        |
| 7     | Done   | Ledger & reporting        | Accounts, posting rules, entries, Z-report, day-close | ✓        |
| 8     | Done   | Compliance & fraud         | Tax agency, VSCU, eTIMS records, reason codes, approval policies/events | ✓        |
| 9     | Done   | Audit & outbox             | Audit log, audit vault (hash chain), outbox enqueue, wired to sale/day close | ✓        |

---

## Per-phase checklist (repeat each phase)

- [ ] Define service interfaces and implement (one module/domain at a time).
- [ ] Add DTOs (request/response) and mappers (MapStruct).
- [ ] Add admin (or operator) controllers under `/api/v1/admin/...` or `/api/v1/operator/...`.
- [ ] Enforce security (existing OAuth2 resource server); scope by org/branch/terminal where applicable.
- [ ] Add validation and error handling (reuse `GlobalExceptionHandler`, `ApiError`, etc.).
- [ ] Write integration tests for main flows (e.g. create category, create item, create sale).
- [ ] Run Checkstyle + Spotless; fix any new violations.
- [ ] **Compile the application** (`mvn clean compile` or `mvn clean install`) to ensure it builds and that generated code (e.g. MapStruct mappers) is produced; run the app to confirm it starts.
- [ ] Update this plan or a CHANGELOG with “Phase X done” and any scope changes.

---

## Notes

- **PRD/FRD:** Acceptance criteria and workflows in [PRD_DOC.md](PRD_DOC.md) and [FRD_DOC.md](FRD_DOC.md) apply; each phase should satisfy the relevant requirements (e.g. Phase 8 → eTIMS, Phase 9 → audit vault, Phase 7 follow-up → ledger postings on sale/cash).
- **No big-bang:** Each phase is implementable and testable on its own. MVP = Phases 1–5 (org + catalog + pricing + till + sales); Phases 6–7 add inventory and ledger/reporting.
- **Operator vs admin:** Keep admin under `/api/v1/admin/orgs/...` and operator under `/api/v1/operator/orgs/{orgId}/branches/.../terminals/...` so security and scoping stay clear.
- **Migrations:** Prefer no new migrations in early phases (schema exists). Add Flyway migrations only when you introduce new tables or columns.
- **Reporting:** Phase 7 added the `reporting` package (ZReportService, ZReportSummaryResponse); extend with more report DTOs/services as needed.

**Next concrete step:** Optional follow-ups remaining: wire Phase 8 into Phase 5 (void/refund require approval; sale complete creates eTIMS record). LedgerPostingService and outbox consumer are done.

---

## Package audit and consistency plan

This section audits all backend packages and lists **missing pieces** so each domain meets the same expectations: **admin (or operator) controller**, **service interface + impl**, **DTOs**, and **at least one integration test** per controller group. Controllers live under `api/v1/admin` (or `api/v1/operator`); domain logic lives in `modules/<domain>`.

### Package audit summary

| Package (module) | Services | Admin/Operator controllers | Missing |
|------------------|----------|----------------------------|--------|
| **organization** | Org, Business, Branch, Terminal, DeviceRegistration, StaffUser, StaffProfile, StaffBranchAssignment, Customer, ReceiptTemplate, PrinterProfile | Org, Business, Branch, Terminal, Device, Staff, Customer, ReceiptTemplate, PrinterProfile | None (Phase A: Customer; Phase F: ReceiptTemplate, PrinterProfile). Missing IT: Terminal, Device, Staff. |
| **catalog** | Category, Uom, TaxProfile, Item, ModifierGroup, ModifierOption, ItemBarcode, ItemUom, ItemModifierGroupLink, ItemImage | All under orgs/{orgId}/... | Covered. ItemModifierGroupLink often used from Item controller. |
| **pricing** | PriceList, PriceListItem, PriceSchedule, ScheduledPrice, PromotionRule, TaxProfile | All under orgs/{orgId}/... | Covered. |
| **cash** | Shift, CashMovement, DayClose, ReceiptSequence | Shift, CashMovement, DayClose (admin read); operator: Shift, CashMovement, DayClose | ReceiptSequence internal only. No IT for ShiftAdmin, CashMovementAdmin, DayCloseAdmin (only ZReport IT). |
| **sales** | Sale, Tender, Receipt, TenderType | TenderType (admin); operator: Sales, receipt-by-sale | No Sale admin list/get (reporting uses Z-report). No IT for TenderTypeAdmin. |
| **inventory** | Supplier, PurchaseOrder, GRN, StockMovement, StockCountSession, TransferOrder, Recipe | All seven admin controllers | All have ITs. |
| **ledger** | LedgerAccount, PostingRule, LedgerEntry, LedgerPosting | LedgerAccount, PostingRule, LedgerEntry | All have ITs. LedgerPosting is internal (no controller). |
| **reporting** | ZReport | ZReport (admin) | Has IT. |
| **compliance** | TaxAgencyConfig, VscuConfig, EtimsInvoiceRecord | All three admin | Only TaxAgencyConfig IT. Missing IT: VscuConfig, EtimsInvoiceRecord. |
| **fraud** | ReasonCode, ApprovalPolicy, ApprovalEvent | All three admin | Only ReasonCode IT. Missing IT: ApprovalPolicy, ApprovalEvent. |
| **audit** | AuditLog, AuditVaultRecord, OutboxEvent | All three admin (read-only) | Only AuditLog IT. Missing IT: AuditVaultRecord, OutboxEvent. |

### Integration test coverage (admin controllers)

- **Have IT:** Catalog (Category, Uom, ModifierGroup, ModifierOption, Item), Pricing (PriceList, TaxProfile), Cash (ZReport), Ledger (LedgerAccount, PostingRule, LedgerEntry), Inventory (all seven), Audit (AuditLog), Compliance (TaxAgencyConfig), Fraud (ReasonCode).
- **Missing IT:** Organization (Terminal, Device, Staff). Operator flows covered by SaleOperatorControllerIT. **Phase B:** OrgAdminControllerIT, BranchAdminControllerIT. **Phase C:** ShiftAdminControllerIT, CashMovementAdminControllerIT, DayCloseAdminControllerIT, TenderTypeAdminControllerIT. **Phase D:** VscuConfigAdminControllerIT, EtimsInvoiceRecordAdminControllerIT, ApprovalPolicyAdminControllerIT, ApprovalEventAdminControllerIT. **Phase E:** AuditVaultRecordAdminControllerIT, OutboxEventAdminControllerIT.

### Phased plan to meet package expectations

| Phase | Focus | Deliverables | Priority |
|-------|--------|--------------|----------|
| **A** | **Organization – Customer** | CustomerService: create, list (paged), update. CustomerAdminController under `/api/v1/admin/orgs/{orgId}/customers`. DTOs (create/update/response). CustomerRepository.findAllByOrgId. CustomerAdminControllerIT. | High – sales need customer creation. **Done.** |
| **B** | **Organization – Admin ITs** | Integration tests for OrgAdminController, BranchAdminController (or minimal “org + branch” flow). | Medium. **Done.** |
| **C** | **Cash & Sales admin ITs** | ShiftAdminControllerIT, CashMovementAdminControllerIT, DayCloseAdminControllerIT; TenderTypeAdminControllerIT. | Medium. **Done.** |
| **D** | **Compliance & fraud ITs** | VscuConfigAdminControllerIT, EtimsInvoiceRecordAdminControllerIT; ApprovalPolicyAdminControllerIT, ApprovalEventAdminControllerIT. | Medium. **Done.** |
| **E** | **Audit ITs** | AuditVaultRecordAdminControllerIT, OutboxEventAdminControllerIT. | Low. **Done.** |
| **F** | **Optional – ReceiptTemplate/PrinterProfile** | If needed: services + admin controllers for receipt template and printer profile (branch/terminal). | Low. **Done.** |

Execution order: **A → B → C → D → E** (F only if product needs it). After Phase A, admins can manage customers per org; sales can attach existing customers to sales.

---

## Phase G – Stock tracking for POS (end-to-end)

**Goal:** Track stock per branch; sales reduce inventory; operator cannot sell when out of stock. Industry-standard POS behaviour, Kenya-friendly UX.

**Current gap:** Sales do not reduce stock. No stock check at add-line or complete. Operator has no visibility of on-hand qty. GRN creates `StockMovement` IN but may not update `InventoryItem.onHandQty`. Item has `trackInventory` flag but it is not enforced in sales.

**Deliverables:**

### Backend (xpos)

1. **Inventory balance maintenance**
   - Ensure GRN creation updates `InventoryItem` (create or increment `onHandQty`) when `StockMovement` IN is created. If `InventoryItem` does not exist for (org, branch, item), create it with `onHandQty` = received qty.
   - Add `InventoryItemService` (or extend existing): `getOrCreate(orgId, branchId, itemId)`, `decrementOnHand(orgId, branchId, itemId, qty)`, `getOnHandQty(orgId, branchId, itemId)`.

2. **Sale completion → stock reduction**
   - On `SaleService.complete()`: for each sale line where `item.trackInventory == true`:
     - Create `StockMovement` (movement_type=OUT, source_type=SALE, source_id=sale.id).
     - Decrement `InventoryItem.onHandQty` for (org, branch, item). Use optimistic locking or `SELECT ... FOR UPDATE` to avoid concurrent oversell.
   - If any line has insufficient stock, throw `IllegalStateException` with user-facing code e.g. `INSUFFICIENT_STOCK` and message like "Hakuna stock ya [item name]. Ni [available] peke yake." (Kenya Swahili-friendly) or "Insufficient stock for [item]. Only [available] remaining."

3. **Stock check at add line (optional but recommended)**
   - In `SaleService.addLine()`: if `item.trackInventory` and `onHandQty < line qty` (considering already-added lines in the same sale), reject with `INSUFFICIENT_STOCK`. Alternatively, defer to complete; either way, complete must enforce.

4. **Operator API – stock levels**
   - `GET /api/v1/operator/orgs/{orgId}/branches/{branchId}/items/stock-levels?itemIds=id1,id2` (or include in items response) – returns `{ itemId, onHandQty }` for items in branch. Enables Menu Order to show "X in stock" or "Out of stock".
   - Response can be part of existing catalog/items API or a dedicated lightweight endpoint.

5. **Admin – inventory balance**
   - Ensure admin can view current stock per branch (via `InventoryItem`). Add or extend `GET /api/v1/admin/orgs/{orgId}/branches/{branchId}/inventory-items` with pagination.

6. **Void/refund**
   - On sale void or refund: reverse stock (create `StockMovement` IN or ADJUST, increment `InventoryItem.onHandQty`).

### Frontend (xpos-ui)

- See **UI_IMPLEMENTATION_PHASES.md** Phase E – Stock levels on Menu Order, block sale when out of stock.

### Acceptance criteria

- Admin adds 2 beers via GRN → `onHandQty` = 2.
- Operator sells 1 beer → `onHandQty` = 1; `StockMovement` OUT created.
- Operator tries to sell 3 beers when only 1 in stock → sale complete fails with clear message.
- Menu Order shows "1 in stock" or "Out of stock" for tracked items; out-of-stock items are disabled or show warning.
- Kenya-friendly: messages in English with optional Swahili hints (e.g. "Hakuna stock" for out of stock).

### Depends on

- Phase 6 (Inventory), Phase 5 (Sales). Existing `InventoryItem`, `StockMovement`, `MovementType.OUT`, `SourceType.SALE`.

---

## Optional follow-ups (no Phase 10)

| Item | Description |
|------|--------------|
| **LedgerPostingService** | Post ledger entries from sale complete / cash movement using posting rules; write to `ledger_entry`. |
| **Wire approvals** | From void/refund (and discount): check approval policies, create approval events, require manager when needed. |
| **Wire eTIMS on sale** | On sale complete: create (and optionally submit) `EtimsInvoiceRecord` for the sale. |
| **Outbox consumer** | Process `OutboxEvent` (e.g. Kafka/sync), update status (SENT/ACKED). **Done:** OutboxKafkaConsumer polls PENDING, publishes to Kafka, marks ACKED/FAILED. |
| **Phase G – Stock tracking** | See Phase G section above. Full end-to-end: GRN updates onHandQty, sale complete reduces stock, operator sees levels, cannot sell when out of stock. |

---

## Handoff for new chat

Copy this one-liner into a new chat to continue work:

```
Read docs/IMPLEMENTATION_PLAN.md and .cursor/rules/project.mdc. Phases 1–9 and A–F are done. Next: implement Phase G (stock tracking) or pick an optional follow-up (LedgerPostingService, wire approvals/eTIMS into sales).
```
