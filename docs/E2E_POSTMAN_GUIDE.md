# XPOS - Run project and E2E test (Postman)

End-to-end flow in **logical order**: org onboarding to selling one bottle of beer, customer pays cash. Use Postman; save IDs from responses for the next requests.

---

## 1. Run the project

**Prerequisites:** Java 21, Maven, PostgreSQL (`xpos_dev`), Redis, Keycloak (realm `xpos`).

```bash
# Create DB and run migrations (once)
psql -U postgres -c "CREATE DATABASE xpos_dev;"
cd /path/to/xpos
mvn flyway:migrate

# Start the app
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

- **Base URL:** `http://localhost:9003`
- **Auth:** All requests below (except step 1) need header: `Authorization: Bearer <access_token>` and `Content-Type: application/json`. Get token from Keycloak (realm xpos); use the token’s `sub` as `iamUserId` when creating the staff user in step 7a.

---

## 2. Endpoints in order (with JSON bodies)

Replace `{orgId}`, `{branchId}`, etc. with IDs from previous responses.

### Step 1 – Health (no auth)

- **GET** `http://localhost:9003/api/v1/health/ping`  
- No body.

---

### Step 2 – Create organization

- **POST** `http://localhost:9003/api/v1/admin/orgs`

```json
{"name": "My Bar & Restaurant"}
```

Save `id` → **orgId**.

---

### Step 3 – Create business

- **POST** `http://localhost:9003/api/v1/admin/orgs/{orgId}/businesses`

```json
{
  "legalName": "My Bar Ltd",
  "kraPin": "P051234567X",
  "logoUrl": null,
  "receiptFooter": "Thank you!"
}
```

Save `id` → **businessId**.

---

### Step 4 – Create branch

- **POST** `http://localhost:9003/api/v1/admin/orgs/{orgId}/branches`

```json
{
  "businessId": "<businessId>",
  "name": "Main Branch",
  "timezone": "Africa/Nairobi",
  "currency": "KES",
  "addressJson": null,
  "taxAgencyConfigId": null,
  "receiptTemplateId": null
}
```

Save `id` → **branchId**.

---

### Step 5 – Create terminal

- **POST** `http://localhost:9003/api/v1/admin/orgs/{orgId}/branches/{branchId}/terminals`

```json
{"terminalCode": "T1", "printerProfileId": null}
```

Save `id` → **terminalId**.

---

### Step 6a – Register device

- **POST** `http://localhost:9003/api/v1/admin/orgs/{orgId}/branches/{branchId}/devices/register`

```json
{"deviceId": "pos-device-001", "deviceFingerprint": "optional"}
```

Save `id` → **deviceRegistrationId**.

### Step 6b – Bind device to terminal

- **POST** `http://localhost:9003/api/v1/admin/orgs/{orgId}/branches/{branchId}/terminals/{terminalId}/bind-device`

```json
{"deviceRegistrationId": "<deviceRegistrationId>"}
```

---

### Step 7a – Create staff user

Use the Keycloak JWT **subject** (`sub`) as `iamUserId`.

- **POST** `http://localhost:9003/api/v1/admin/orgs/{orgId}/staff-users`

```json
{"iamUserId": "<JWT sub from Keycloak>", "username": "cashier1"}
```

Save `id` → **staffUserId**.

### Step 7b – Set staff profile

- **PUT** `http://localhost:9003/api/v1/admin/orgs/{orgId}/staff-users/{staffUserId}/profile`

```json
{
  "displayName": "Cashier One",
  "phone": null,
  "email": null,
  "employeeNo": "EMP001",
  "defaultBranchId": "<branchId>",
  "status": "ACTIVE"
}
```

### Step 7c – Assign staff to branch

- **POST** `http://localhost:9003/api/v1/admin/orgs/{orgId}/staff-users/{staffUserId}/branches`

```json
{"branchId": "<branchId>", "primary": true}
```

---

### Step 8a – Category

- **POST** `http://localhost:9003/api/v1/admin/orgs/{orgId}/categories`

```json
{"parentId": null, "name": "Beverages", "type": "PRODUCT"}
```

Save `id` → **categoryId**.

### Step 8b – UoM (bottle)

- **POST** `http://localhost:9003/api/v1/admin/orgs/{orgId}/uoms`

```json
{"name": "Bottle", "symbol": "btl"}
```

Save `id` → **uomId**.

### Step 8c – Tax profile

- **POST** `http://localhost:9003/api/v1/admin/orgs/{orgId}/tax-profiles`

```json
{
  "name": "VAT Standard",
  "vatCategory": "STANDARD",
  "serviceChargeRate": 0,
  "levyRate": 0
}
```

Save `id` → **taxProfileId**.

### Step 8d – Item (beer)

- **POST** `http://localhost:9003/api/v1/admin/orgs/{orgId}/items`

```json
{
  "sku": "BEER-001",
  "name": "Tusker Bottle 500ml",
  "itemType": "STOCK",
  "categoryId": "<categoryId>",
  "baseUomId": "<uomId>",
  "taxProfileId": "<taxProfileId>",
  "trackInventory": false,
  "active": true
}
```

Save `id` → **itemId**.

---

### Step 9a – Price list

- **POST** `http://localhost:9003/api/v1/admin/orgs/{orgId}/price-lists`

```json
{
  "branchId": "<branchId>",
  "channel": null,
  "name": "Default",
  "priority": 0,
  "active": true
}
```

Save `id` → **priceListId**.

### Step 9b – Price list item (beer price)

- **POST** `http://localhost:9003/api/v1/admin/orgs/{orgId}/price-lists/{priceListId}/items`

```json
{"itemId": "<itemId>", "price": 150, "currency": "KES"}
```

---

### Step 10 – Tender type (cash)

- **POST** `http://localhost:9003/api/v1/admin/orgs/{orgId}/tender-types`

```json
{"code": "CASH", "name": "Cash"}
```

Save `id` → **tenderTypeId**.

---

### Step 10a – Ledger account (Cash)

Required so sale completion can post double-entry ledger entries.

- **POST** `http://localhost:9003/api/v1/admin/orgs/{orgId}/ledger-accounts`

```json
{"code": "1000", "name": "Cash", "accountType": "ASSET"}
```

### Step 10b – Ledger account (Sales)

- **POST** `http://localhost:9003/api/v1/admin/orgs/{orgId}/ledger-accounts`

```json
{"code": "4000", "name": "Sales", "accountType": "INCOME"}
```

### Step 10c – Posting rule (SALE_COMPLETE)

Links sale-complete events to debit Cash (1000) and credit Sales (4000).

- **POST** `http://localhost:9003/api/v1/admin/orgs/{orgId}/posting-rules`

```json
{"eventType": "SALE_COMPLETE", "debitAccountCode": "1000", "creditAccountCode": "4000"}
```

---

### Step 11 – Open shift (operator)

- **POST** `http://localhost:9003/api/v1/operator/orgs/{orgId}/branches/{branchId}/terminals/{terminalId}/shifts`

```json
{"openingFloatAmount": 500}
```

---

### Step 12 – Create sale (operator)

- **POST** `http://localhost:9003/api/v1/operator/orgs/{orgId}/branches/{branchId}/terminals/{terminalId}/sales`

```json
{"customerId": null, "priceListId": "<priceListId>"}
```

Or `{}` to use default price list. Save `id` → **saleId**.

---

### Step 13 – Add line (one bottle of beer)

- **POST** `http://localhost:9003/api/v1/operator/orgs/{orgId}/branches/{branchId}/terminals/{terminalId}/sales/{saleId}/lines`

```json
{
  "itemId": "<itemId>",
  "qty": 1,
  "uomId": null,
  "unitPriceOverride": null,
  "modifiers": []
}
```

---

### Step 14 – Add tender (customer pays cash)

- **POST** `http://localhost:9003/api/v1/operator/orgs/{orgId}/branches/{branchId}/terminals/{terminalId}/sales/{saleId}/tenders`

```json
{"tenderTypeId": "<tenderTypeId>", "amount": 200, "currency": "KES"}
```

---

### Step 15 – Complete sale

- **POST** `http://localhost:9003/api/v1/operator/orgs/{orgId}/branches/{branchId}/terminals/{terminalId}/sales/{saleId}/complete`

No body.

---

### Step 16 – Get receipt

- **GET** `http://localhost:9003/api/v1/operator/orgs/{orgId}/branches/{branchId}/terminals/{terminalId}/sales/{saleId}/receipt`

No body.

### Step 16b – Get receipt details (full: amounts, lines, tax, tenders, change)

- **GET** `http://localhost:9003/api/v1/operator/orgs/{orgId}/branches/{branchId}/terminals/{terminalId}/sales/{saleId}/receipt/details`

No body. Returns subtotal, taxTotal, total, amountTendered, changeDue, lines, taxLines, tenders.

---

## 3. Quick reference – all endpoints in order

| # | Method | Path |
|---|--------|------|
| 1 | GET | /api/v1/health/ping |
| 2 | POST | /api/v1/admin/orgs |
| 3 | POST | /api/v1/admin/orgs/{orgId}/businesses |
| 4 | POST | /api/v1/admin/orgs/{orgId}/branches |
| 5 | POST | /api/v1/admin/orgs/{orgId}/branches/{branchId}/terminals |
| 6a | POST | /api/v1/admin/orgs/{orgId}/branches/{branchId}/devices/register |
| 6b | POST | /api/v1/admin/orgs/{orgId}/branches/{branchId}/terminals/{terminalId}/bind-device |
| 7a | POST | /api/v1/admin/orgs/{orgId}/staff-users |
| 7b | PUT | /api/v1/admin/orgs/{orgId}/staff-users/{staffUserId}/profile |
| 7c | POST | /api/v1/admin/orgs/{orgId}/staff-users/{staffUserId}/branches |
| 8a | POST | /api/v1/admin/orgs/{orgId}/categories |
| 8b | POST | /api/v1/admin/orgs/{orgId}/uoms |
| 8c | POST | /api/v1/admin/orgs/{orgId}/tax-profiles |
| 8d | POST | /api/v1/admin/orgs/{orgId}/items |
| 9a | POST | /api/v1/admin/orgs/{orgId}/price-lists |
| 9b | POST | /api/v1/admin/orgs/{orgId}/price-lists/{priceListId}/items |
| 10 | POST | /api/v1/admin/orgs/{orgId}/tender-types |
| 10a | POST | /api/v1/admin/orgs/{orgId}/ledger-accounts |
| 10b | POST | /api/v1/admin/orgs/{orgId}/ledger-accounts |
| 10c | POST | /api/v1/admin/orgs/{orgId}/posting-rules |
| 11 | POST | /api/v1/operator/orgs/{orgId}/branches/{branchId}/terminals/{terminalId}/shifts |
| 12 | POST | /api/v1/operator/orgs/{orgId}/branches/{branchId}/terminals/{terminalId}/sales |
| 13 | POST | /api/v1/operator/.../sales/{saleId}/lines |
| 14 | POST | /api/v1/operator/.../sales/{saleId}/tenders |
| 15 | POST | /api/v1/operator/.../sales/{saleId}/complete |
| 16 | GET | /api/v1/operator/.../sales/{saleId}/receipt |
| 16b | GET | /api/v1/operator/.../sales/{saleId}/receipt/details |

Base URL for all: **http://localhost:9003**

---

## 4. Full API reference (all endpoints)

For manual verification of **every** endpoint with request samples, see **[E2E_FULL_API_REFERENCE.md](E2E_FULL_API_REFERENCE.md)**. That document lists all 204 endpoints by area (Health, Organization, Catalog, Pricing, Sales, Cash, Inventory, Ledger, Compliance, Fraud, Audit) with HTTP method, path, query params, and sample request bodies for POST/PUT/PATCH.
