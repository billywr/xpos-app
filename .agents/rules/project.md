---
description: XPOS Spring Boot backend — hard constraints, architecture rules, workflow (production POS, Kenya)
alwaysApply: true
---

You are working on XPOS: a production-grade multi-vertical POS for Kenya (supermarkets, retail shops, pubs/bars, restaurants, hotels).
This is a control + accounting system (anti-leakage, accountability, auditability), not just a cashier app.

> Module layout, domain model, build commands, Lombok/MapStruct: see `architecture.md`.

HARD CONSTRAINTS (non-negotiable)
1) Checkstyle compliance is mandatory.
   - No tabs. 4-space indentation.
   - Newline at EOF.
   - Max line length 140 characters.
   - No wildcard/star imports.
   - No unused imports.
   - Naming rules apply to methods (camelCase only; no underscores).
   - Method length <= 100 lines (split logically if needed).
   - Keep code formatting consistent with existing project style.

2) Database is defined ONLY via Flyway migrations.
   - Do not enable Hibernate schema generation.
   - Do not add @GeneratedValue strategies that conflict with DB defaults unless clearly required.
   - All schema changes must be new Flyway migrations (append-only). Never edit old migrations.

3) Single Spring Boot monolith for now (no microservices).
   - One service, modular packages.
   - Splitting can come later, but code must be cleanly modularized.

4) Keycloak is external IAM. Backend is a resource server.
   - Do not implement login/auth flows in XPOS.
   - Always treat JWT sub as iamUserId.
   - Authorization is enforced in XPOS based on staff_user and assignments.
   - Operator endpoints (shift, cash, day close) resolve current staff via requireStaffUserForBranch(orgId, branchId, iamUserId); fallback by branch assignment when not found by org+iamUserId.

5) Error handling must be user-facing and specific.
   - No generic “Unhandled error” unless truly unknown 500.
   - Validation errors must return field-level details.
   - Database constraint violations must translate to meaningful messages.
   - Always include requestId in error responses.

6) Repository query methods must be Checkstyle-safe.
   - Do not use derived method names containing underscore (e.g., findByOrg_Id).
   - Use JPQL @Query with text blocks correctly:
     - Opening """ must be followed by a newline.
   - Keep method names camelCase without underscores.

7) Do not introduce vendor-specific JDBC dependency usage in app logic.
   - Avoid org.postgresql.util.PSQLException usage.
   - Translate DB errors via java.sql.SQLException + SQLSTATE + safe parsing.

ARCHITECTURE RULES
A) Multi-tenant scoping via orgId is mandatory.
   - Every admin and business operation must be org-scoped.
   - Repositories must support orgId filtering.
   - Services must validate org ownership (no cross-org access).

B) “Control system” behavior is mandatory.
   - No transactions without valid: org → branch → terminal → device → staff assignment (as applicable).
   - Future packets: shift control, blind close, approvals, audit chain.

C) Packetized development only.
   - Implement in small packets with clear boundaries.
   - Each packet must compile, pass Checkstyle, and be testable.

D) Layers are required:
   - Controller -> DTO -> Service interface -> Service implementation -> Repository.
   - Services hold transactional boundaries (@Transactional).
   - Controllers must not contain business logic.

E) DTO strategy:
   - Use request/response DTOs for API layer.
   - Validate using jakarta.validation.
   - Never expose internal entity graph unintentionally (avoid LAZY serialization problems).
   - If you do return entities temporarily, ensure no cycles and no lazy init errors.
   - Use Mapstruct where possible
   - LAZY-loading pitfall: When controllers map entities to DTOs, accessing LAZY associations
     after the service transaction ends causes LazyInitializationException → 500. ALWAYS add
     JOIN FETCH in repository queries for associations used in response mapping (org, branch,
     item, supplier, etc.). Example: left join fetch e.org left join fetch e.branch

F) Pagination:
   - List endpoints must use Pageable and clamp via PageRequestFactory (max size, default sort).
   - Never return unbounded lists by default.

G) Testing:
   - Add at least one integration test for each new controller group.
   - Validate requestId header behavior for relevant endpoints.
   - Keep tests deterministic (Clock bean usage where time matters).
   - Integration tests: Extend AbstractIntegrationTest (@Tag("integration")). By default they are
     EXCLUDED; only SimpleSanityTest runs. To run full suite: mvn test -Psurefire-integration.
     Docker must be running (Testcontainers: Postgres). CI pipeline runs with this profile.

H) PriceListItem / addItemToPriceList:
   - PriceListItemService.add enforces: item must have purchase history (GRN/stock movement with
     unit cost) and selling price must exceed max unit cost. Without GRN → 400 ITEM_NOT_SUPPLIED.
   - Tests that add items to price lists MUST first: createSupplier(orgId),
     createGrnForItem(orgId, branchId, supplierId, itemId), then addItemToPriceList.
   - Use unit cost in GRN lower than selling price (e.g. 40–80 vs 99.50 or 150).

CODING STANDARDS
- Prefer explicit, readable code over cleverness.
- Use Objects.requireNonNull in constructors.
- No reflection hacks.
- No star imports.
- Use final where appropriate.
- Keep methods small; split if approaching 100 lines.
- Favor meaningful error codes (UPPER_SNAKE_CASE) and user messages that can be shown to POS operators.

API STANDARDS
- Use /api/v1 prefix.
- Admin endpoints must be under /api/v1/admin.
- Include orgId scoping (path or query) consistently. Prefer path for admin resources.
- Response errors must include:
  - code
  - message (user-facing)
  - requestId
  - details (optional key-value list)
- Always return 409 for conflicts, 404 for missing resources, 400 for validation issues, 403 for forbidden, 401 for auth problems.

COMMON GOTCHAS TO AVOID
- Do not use @Query("""select ...""") without newline after opening delimiter.
- Do not import MethodArgumentTypeMismatchException from org.springframework.web.bind (wrong).
  Use org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.
- Do not construct ApiErrorDetail with wrong arity. Check record signature.
- Do not introduce orgId traversal underscores in repository method names.
- Do not allow Springdoc/OpenAPI dependencies that create Boot auto-config conflicts unless isolated to dev-only and proven compatible.
- Page list endpoints: JSON has `content` array. In tests use $.content.length() not $.length(); $.content[0].field not $[0].field.

WORKFLOW FOR ANY CHANGE (ROBUST / PRODUCTION-GRADE)
   0) Define scope + correctness constraints
   1) Schema-first (Flyway only)
   2) Domain modeling (entities match DB exactly)
   3) Repository layer (org-scoped by default, Checkstyle-safe)
   4) Service layer (transactional boundaries + invariants)
   5) API layer (DTOs, validation, safe responses)
   6) Error handling (user-facing, specific)
   7) Tests (minimum required, edge cases included)
   8) Verification commands:
      - ./mvnw spotless:apply
      - ./mvnw clean compile
      - ./mvnw checkstyle:check
      - ./mvnw test
      - ./mvnw test -Psurefire-integration
   9) Deliverable checklist
