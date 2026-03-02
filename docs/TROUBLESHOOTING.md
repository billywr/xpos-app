# XPOS – Troubleshooting: errors and fixes

This document records common errors when running or building XPOS and the fixes applied.

---

## 1. Run / IDE

### 1.1 Maximum pool size: undefined/unknown

**Symptom:** Log line shows `Minimum pool size: undefined/unknown` and `Maximum pool size: undefined/unknown`; Hikari config seems missing.

**Cause:** The **dev** profile was not active, so `application-dev.yml` (datasource URL, Hikari settings) was not loaded.

**Fix:** Ensure the dev profile is used when running:

- A default **`src/main/resources/application.yml`** was added with `spring.profiles.active: dev`, so running without setting a profile (e.g. from IntelliJ) now loads dev by default.
- Or in IntelliJ: Run → Edit Configurations → set **Active profiles** to `dev`.

---

### 1.2 Schema validation: missing table [approval_event]

**Symptom:** Application fails to start with:

```text
Schema validation: missing table [approval_event]
```

**Cause:** The database (e.g. `xpos_dev`) exists but **Flyway migrations have not been run**, so the schema is empty or incomplete.

**Fix:**

1. Create the database if needed: `psql -U postgres -c "CREATE DATABASE xpos_dev;"`
2. Run Flyway migrations once:
   ```bash
   mvn flyway:migrate
   ```
   (The Flyway Maven plugin is configured in `pom.xml` with default URL/user/password for `xpos_dev`. Override with `-Dflyway.url=...` if your DB is elsewhere.)
3. Start the application again.

See also **[RUN_IN_IDE.md](RUN_IN_IDE.md)**.

---

### 1.3 Schema validation: wrong column type for [starts_at] / [ends_at] in table [price_schedule]

**Symptom:** Startup fails with:

```text
Schema validation: wrong column type encountered in column [ends_at] in table [price_schedule];
found [time (Types#TIME)], but expecting [varchar(255) (Types#VARCHAR)]
```

**Cause:** The database has `starts_at` and `ends_at` as PostgreSQL **TIME**, but the JPA entity had them as **String** (mapping to VARCHAR).

**Fix:** The entity was updated to match the database:

- **`PriceSchedule.java`:** `startsAt` and `endsAt` changed from `String` to `java.time.LocalTime`.
- **`PriceScheduleServiceImpl.java`:** API still accepts String (e.g. `"09:00"`); the service parses with `LocalTime.parse(time)` before setting on the entity. A small `parseTime(String)` helper was added.
- **`PriceScheduleAdminController.java`:** `toResponse()` uses `schedule.getStartsAt().toString()` and `schedule.getEndsAt().toString()` so the REST API still returns time strings.

No database or migration changes were required.

---

### 1.4 column "status" is of type status_common but expression is of type character varying

**Symptom:** On create (e.g. create org), the app fails with:

```text
column "status" is of type status_common but expression is of type character varying
Hint: You will need to rewrite or cast the expression.
```

**Cause:** PostgreSQL columns use **native enum** types (e.g. `status_common`). Hibernate with `@Enumerated(EnumType.STRING)` binds enum values as VARCHAR, and PostgreSQL rejects that unless an implicit cast exists.

**Fix:** A Flyway migration **V5__postgresql_enum_varchar_implicit_casts.sql** was added. It creates implicit casts from `character varying` to every PostgreSQL enum type used in the schema (e.g. `status_common`, `sale_status`, `outbox_status`, etc.). After running migrations (`mvn flyway:migrate` or on app startup), INSERT/UPDATE for all enum columns work without any Java entity changes.

---

### 1.5 ObjectMapper bean not found

**Symptom:** Application fails to start with:

```text
Parameter 2 of constructor in com.blinc.xpos.api.v1.admin.pricing.PromotionRuleAdminController
required a bean of type 'com.fasterxml.jackson.databind.ObjectMapper' that could not be found.
```

**Cause:** `PromotionRuleAdminController` and `OutboxKafkaConsumer` depend on `ObjectMapper`; in some startup orderings the auto-configured Jackson bean was not available.

**Fix:** An explicit `ObjectMapper` bean was added so it is always present:

- **`config/web/WebFoundationConfig.java`:** Added:
  ```java
  @Bean
  public ObjectMapper objectMapper() {
    return new ObjectMapper();
  }
  ```

---

### 1.6 Port 9003 already in use

**Symptom:** Startup fails with:

```text
Web server failed to start. Port 9003 was already in use.
```

**Cause:** Another process (e.g. a previous run of XPOS or another app) is already listening on port 9003.

**Fix:**

- Stop the other process (e.g. stop the run in IntelliJ, or run `fuser -k 9003/tcp` on Linux).
- Or run on another port, e.g. `-Dserver.port=9004`.

---

### 1.7 Soft-delete fails: null value in column "status" violates not-null constraint

**Symptom:** When soft-deleting an org (or branch, business, terminal, device, staff user), the app fails with:

```text
ERROR: null value in column "status" of relation "org" violates not-null constraint
Detail: Failing row contains (..., null, ...)
```

**Cause:** The PostgreSQL enum `status_common` originally had only `ACTIVE` and `INACTIVE`. Migration **V10** adds the `DELETED` value. The varchar-to-enum cast (from V6) looks up the input string in `enum_range(status_common)`; if `DELETED` is not in the enum, no match is found and the cast returns NULL, which violates the NOT NULL constraint.

**Fix:** Apply V10 migration or run the fix script manually.

Option 1 – Flyway:
```bash
mvn flyway:migrate
```
(Use `-Dflyway.url=... -Dflyway.user=... -Dflyway.password=...` for a custom DB.)

Option 2 – Direct SQL (matches `application-dev.yml`):
```bash
psql -h localhost -U postgres -d xpos_dev -c "ALTER TYPE status_common ADD VALUE IF NOT EXISTS 'DELETED';"
```
Or: `psql -h localhost -U postgres -d xpos_dev -f scripts/fix-dev-db-status-enum.sql`

Then restart the application. All soft-deletes (org, branch, business, terminal, device, staff user) require V10.

Integration tests cover soft-delete (`OrgAdminControllerIT`, `BranchAdminControllerIT`, etc.). Run with:
`mvn test -Psurefire-integration -Dtest=OrgAdminControllerIT`

---

### 1.8 Soft-delete API endpoints

| Resource | Method | Path |
|----------|--------|------|
| Org | DELETE | `/api/v1/admin/orgs/{orgId}` |
| Branch | DELETE | `/api/v1/admin/orgs/{orgId}/branches/{branchId}` |
| Business | DELETE | `/api/v1/admin/orgs/{orgId}/businesses/{businessId}` |
| Terminal | DELETE | `/api/v1/admin/orgs/{orgId}/branches/{branchId}/terminals/{terminalId}` |
| Device | DELETE | `/api/v1/admin/orgs/{orgId}/devices/{deviceRegistrationId}` |
| Staff User | DELETE | `/api/v1/admin/orgs/{orgId}/staff-users/{staffUserId}` |

All perform **soft-delete** (set `status = DELETED`); records remain in the DB but are excluded from list endpoints.

---

## 2. Flyway from command line

### 2.1 No Flyway database plugin found for PostgreSQL

**Symptom:** `mvn flyway:migrate` fails with:

```text
No Flyway database plugin found to handle jdbc:postgresql://...
```

**Cause:** Flyway 11+ uses separate database plugins; the Maven plugin did not have the PostgreSQL driver/plugin on its classpath.

**Fix:** The **Flyway Maven plugin** in `pom.xml` was configured with:

- Default URL/user/password for `xpos_dev` (overridable via `-Dflyway.url=...` etc.).
- Dependencies: `flyway-database-postgresql` and `postgresql` (with versions) so `mvn flyway:migrate` works against PostgreSQL.

---

## 3. Documentation / Markdown preview

### 3.1 E2E_POSTMAN_GUIDE.md preview not loading

**Symptom:** Markdown preview does not show the guide, or shows “Error loading webview: Could not register service worker”.

**Cause:** Usually an **IDE webview / Service Worker** issue, not the file content. Some preview engines also struggle with long lines or certain Unicode characters.

**Fixes applied to the doc:**

- Replaced Unicode en-dashes (–) with ASCII hyphens (-) in headings and body.
- Shortened the “Quick reference” table to reduce very long lines.
- Added a short **E2E_POSTMAN_GUIDE_SUMMARY.md** for a lighter preview; added a note at the top of the full guide explaining the webview error and suggesting **Developer: Reload Window** or opening the summary file.

---

## 4. Integration tests (Docker)

### 4.1 Integration tests fail: "Could not find a valid Docker environment" or "client version 1.32 is too old"

**Symptom:** When running `mvn test -Psurefire-integration`, many tests fail with:

```text
IllegalStateException: Could not find a valid Docker environment. Please see logs and check configuration
```
or:
```text
BadRequestException: client version 1.32 is too old. Minimum supported API version is 1.44, please upgrade your client to a newer version
```

**Cause:**

- **No Docker:** Docker daemon is not running or not installed; or the test process cannot reach it (e.g. wrong `DOCKER_HOST`).
- **Docker API too old:** Testcontainers 1.19+ requires Docker API **1.44** or newer. Older Docker Engine or old `docker-java` client can report 1.32.

**Fixes:**

1. **To run integration tests:** Ensure Docker is running (`docker info`) and that your Docker Engine supports API 1.44+ (Docker 24+). Upgrade Docker if necessary.
2. **Run without integration tests (no Docker):** Use default `mvn test` (without `-Psurefire-integration`). Integration tests are then excluded and not run; only unit/sanity tests run.

---

## 5. Reference

| Doc | Purpose |
|-----|---------|
| [RUN_IN_IDE.md](RUN_IN_IDE.md) | How to run XPOS in IntelliJ; DB and profile setup. |
| [E2E_POSTMAN_GUIDE.md](E2E_POSTMAN_GUIDE.md) | Full E2E flow and Postman request bodies. |
| [E2E_POSTMAN_GUIDE_SUMMARY.md](E2E_POSTMAN_GUIDE_SUMMARY.md) | Short E2E summary; use if the full guide does not preview. |
| [E2E_TESTING.md](E2E_TESTING.md) | How to run integration tests; skip when Docker is unavailable. |
