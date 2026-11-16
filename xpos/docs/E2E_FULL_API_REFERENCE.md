# XPOS – Full API reference (all endpoints)

Base URL: **http://localhost:9003**. All requests (except health) need: `Authorization: Bearer <token>`, `Content-Type: application/json`. Replace `{orgId}`, `{branchId}`, etc. with IDs from your flow.

**Frontend:** For a React (Tailwind, Redux) UI, see **FRONTEND_IMPLEMENTATION.md** (structure, auth, API client, Redux) and **FRONTEND_CURSOR_RULES.md** (content for `.cursor/rules/project.mdc` in the frontend repo).

---

## Health

| Method | Path | Body / query |
|--------|------|----------------|
| GET | /api/v1/health/ping | No body. No auth. |

---

## Me

| Method | Path | Body / query |
|--------|------|----------------|
| GET | /api/v1/me | No body. Query: `orgId` (required). |

---

## Organization – Orgs

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs | `{"name": "My Org"}` |
| GET | /api/v1/admin/orgs | Query: `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId} | No body |
| GET | /api/v1/admin/orgs/{orgId}/context | No body |
| PATCH | /api/v1/admin/orgs/{orgId} | `{"name": "New Name", "status": "ACTIVE"}` |

---

## Organization – Businesses

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/businesses | `{"legalName": "Biz Ltd", "kraPin": null, "logoUrl": null, "receiptFooter": null}` |
| GET | /api/v1/admin/orgs/{orgId}/businesses | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/businesses/{businessId} | No body |
| PATCH | /api/v1/admin/orgs/{orgId}/businesses/{businessId} | `{"legalName": "New Name", "kraPin": null, "logoUrl": null, "receiptFooter": null}` |

---

## Organization – Branches

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/branches | `{"businessId": "<id>", "name": "Main", "timezone": "Africa/Nairobi", "currency": "KES", "addressJson": null, "taxAgencyConfigId": null, "receiptTemplateId": null}` |
| GET | /api/v1/admin/orgs/{orgId}/branches | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/branches/{branchId} | No body |
| PATCH | /api/v1/admin/orgs/{orgId}/branches/{branchId} | Same shape as create |

---

## Organization – Terminals

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/branches/{branchId}/terminals | `{"terminalCode": "T1", "printerProfileId": null}` |
| GET | /api/v1/admin/orgs/{orgId}/branches/{branchId}/terminals | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/branches/{branchId}/terminals/{terminalId} | No body |
| PATCH | /api/v1/admin/orgs/{orgId}/branches/{branchId}/terminals/{terminalId} | `{"terminalCode": "T2", "printerProfileId": null}` |
| POST | /api/v1/admin/orgs/{orgId}/branches/{branchId}/terminals/{terminalId}/bind-device | `{"deviceRegistrationId": "<id>"}` |

---

## Organization – Devices

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/branches/{branchId}/devices/register | `{"deviceId": "device-001", "deviceFingerprint": null}` |
| GET | /api/v1/admin/orgs/{orgId}/devices | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/devices/{deviceRegistrationId} | No body |
| POST | /api/v1/admin/orgs/{orgId}/devices/{deviceRegistrationId}/activate | No body |
| POST | /api/v1/admin/orgs/{orgId}/devices/{deviceRegistrationId}/deactivate | No body |
| POST | /api/v1/admin/orgs/{orgId}/devices/by-device-id/{deviceId}/heartbeat | `{}` or no body |

---

## Organization – Staff users

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/staff-users | `{"iamUserId": "<JWT sub>", "username": "cashier1"}` |
| GET | /api/v1/admin/orgs/{orgId}/staff-users | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/staff-users/{staffUserId} | No body |
| PATCH | /api/v1/admin/orgs/{orgId}/staff-users/{staffUserId}/status | `{"status": "ACTIVE"}` or `"INACTIVE"` |
| PUT | /api/v1/admin/orgs/{orgId}/staff-users/{staffUserId}/profile | `{"displayName": "Name", "phone": null, "email": null, "employeeNo": "E001", "defaultBranchId": "<branchId>", "status": "ACTIVE"}` |
| GET | /api/v1/admin/orgs/{orgId}/staff-users/{staffUserId}/profile | No body |
| POST | /api/v1/admin/orgs/{orgId}/staff-users/{staffUserId}/branches | `{"branchId": "<id>", "primary": true}` |
| GET | /api/v1/admin/orgs/{orgId}/staff-users/{staffUserId}/branches | Query: `includeBranch` (optional) |

---

## Organization – Customers

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/customers | `{"name": "John", "phone": null, "email": null}` |
| GET | /api/v1/admin/orgs/{orgId}/customers | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/customers/{customerId} | No body |
| PATCH | /api/v1/admin/orgs/{orgId}/customers/{customerId} | `{"name": "John", "phone": null, "email": null, "active": true}` |

---

## Organization – Receipt templates

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/receipt-templates | `{"name": "Default", "templateJson": {}}` |
| GET | /api/v1/admin/orgs/{orgId}/receipt-templates | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/receipt-templates/{templateId} | No body |
| PATCH | /api/v1/admin/orgs/{orgId}/receipt-templates/{templateId} | `{"name": "Default", "templateJson": {}, "active": true}` |

---

## Organization – Printer profiles

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/printer-profiles | `{"name": "Kitchen", "configJson": {}}` |
| GET | /api/v1/admin/orgs/{orgId}/printer-profiles | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/printer-profiles/{profileId} | No body |
| PATCH | /api/v1/admin/orgs/{orgId}/printer-profiles/{profileId} | `{"name": "Kitchen", "configJson": {}, "active": true}` |

---

## Catalog – Categories

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/categories | `{"parentId": null, "name": "Beverages", "type": "PRODUCT"}` |
| GET | /api/v1/admin/orgs/{orgId}/categories | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/categories/{categoryId} | No body |
| PATCH | /api/v1/admin/orgs/{orgId}/categories/{categoryId} | Same shape as create |

---

## Catalog – UoMs

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/uoms | `{"name": "Bottle", "symbol": "btl"}` |
| GET | /api/v1/admin/orgs/{orgId}/uoms | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/uoms/{uomId} | No body |
| PATCH | /api/v1/admin/orgs/{orgId}/uoms/{uomId} | Same shape as create |

---

## Catalog – Tax profiles

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/tax-profiles | `{"name": "VAT Standard", "vatCategory": "STANDARD", "serviceChargeRate": 0, "levyRate": 0}` |
| GET | /api/v1/admin/orgs/{orgId}/tax-profiles | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/tax-profiles/{taxProfileId} | No body |
| PATCH | /api/v1/admin/orgs/{orgId}/tax-profiles/{taxProfileId} | Same shape as create |

---

## Catalog – Items

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/items | `{"sku": "SKU-1", "name": "Item", "itemType": "STOCK", "categoryId": "<id>", "baseUomId": "<id>", "taxProfileId": "<id>", "trackInventory": false, "active": true}` |
| GET | /api/v1/admin/orgs/{orgId}/items | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/items/{itemId} | No body |
| PATCH | /api/v1/admin/orgs/{orgId}/items/{itemId} | Same shape as create |

---

## Catalog – Item barcodes

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/items/{itemId}/barcodes | `{"barcode": "1234567890123"}` |
| GET | /api/v1/admin/orgs/{orgId}/items/{itemId}/barcodes | No body |
| GET | /api/v1/admin/orgs/{orgId}/items/{itemId}/barcodes/{barcodeId} | No body |
| DELETE | /api/v1/admin/orgs/{orgId}/items/{itemId}/barcodes/{barcodeId} | No body |

---

## Catalog – Item UoMs

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/items/{itemId}/uoms | `{"uomId": "<id>", "conversionToBase": 1}` |
| GET | /api/v1/admin/orgs/{orgId}/items/{itemId}/uoms | No body |
| GET | /api/v1/admin/orgs/{orgId}/items/{itemId}/uoms/{itemUomId} | No body |
| DELETE | /api/v1/admin/orgs/{orgId}/items/{itemId}/uoms/{itemUomId} | No body |

---

## Catalog – Item images

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/items/{itemId}/images | `{"url": "https://example.com/img.png", "sortOrder": 0}` |
| GET | /api/v1/admin/orgs/{orgId}/items/{itemId}/images | No body |
| GET | /api/v1/admin/orgs/{orgId}/items/{itemId}/images/{imageId} | No body |
| DELETE | /api/v1/admin/orgs/{orgId}/items/{itemId}/images/{imageId} | No body |

---

## Catalog – Modifier groups

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/modifier-groups | `{"name": "Size", "minSelect": 0, "maxSelect": 1, "required": false}` |
| GET | /api/v1/admin/orgs/{orgId}/modifier-groups | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/modifier-groups/{modifierGroupId} | No body |
| PATCH | /api/v1/admin/orgs/{orgId}/modifier-groups/{modifierGroupId} | Same shape as create |

---

## Catalog – Modifier options

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/modifier-groups/{modifierGroupId}/options | `{"name": "Large", "priceDelta": 50}` |
| GET | /api/v1/admin/orgs/{orgId}/modifier-groups/{modifierGroupId}/options | No body |
| GET | .../options/{modifierOptionId} | No body |
| PATCH | .../options/{modifierOptionId} | Same shape as create |

---

## Catalog – Item–modifier group links

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/items/{itemId}/modifier-groups | `{"modifierGroupId": "<id>"}` |
| GET | /api/v1/admin/orgs/{orgId}/items/{itemId}/modifier-groups | No body |
| GET | .../modifier-groups/{itemModifierGroupId} | No body |
| DELETE | .../modifier-groups/{itemModifierGroupId} | No body |

---

## Pricing – Price lists

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/price-lists | `{"branchId": "<id>", "channel": null, "name": "Default", "priority": 0, "active": true}` |
| GET | /api/v1/admin/orgs/{orgId}/price-lists | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/price-lists/{priceListId} | No body |
| PATCH | /api/v1/admin/orgs/{orgId}/price-lists/{priceListId} | Same shape as create |

---

## Pricing – Price list items

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/price-lists/{priceListId}/items | `{"itemId": "<id>", "price": 150, "currency": "KES"}` |
| GET | /api/v1/admin/orgs/{orgId}/price-lists/{priceListId}/items | No body |
| GET | .../items/{priceListItemId} | No body |
| DELETE | .../items/{priceListItemId} | No body |

---

## Pricing – Price schedules

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/price-schedules | `{"branchId": "<id>", "name": "Happy Hour", "startsAt": "17:00", "endsAt": "19:00", "daysOfWeek": 127}` |
| GET | /api/v1/admin/orgs/{orgId}/price-schedules | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/price-schedules/{priceScheduleId} | No body |
| PATCH | /api/v1/admin/orgs/{orgId}/price-schedules/{priceScheduleId} | Same shape as create |

---

## Pricing – Scheduled prices

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/price-schedules/{priceScheduleId}/prices | `{"itemId": "<id>", "price": 100, "currency": "KES"}` |
| GET | .../prices | No body |
| GET | .../prices/{scheduledPriceId} | No body |
| DELETE | .../prices/{scheduledPriceId} | No body |

---

## Pricing – Promotion rules

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/promotion-rules | `{"branchId": null, "name": "Buy 2", "ruleType": "BOGO", "conditionsJson": {}, "actionsJson": {}, "priority": 0, "active": true}` |
| GET | /api/v1/admin/orgs/{orgId}/promotion-rules | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/promotion-rules/{promotionRuleId} | No body |
| PATCH | /api/v1/admin/orgs/{orgId}/promotion-rules/{promotionRuleId} | Same shape as create |

---

## Sales – Tender types

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/tender-types | `{"code": "CASH", "name": "Cash"}` |
| GET | /api/v1/admin/orgs/{orgId}/tender-types | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/tender-types/{tenderTypeId} | No body |

---

## Sales – Table areas (branch-scoped)

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/branches/{branchId}/table-areas | `{"name": "Patio"}` |
| GET | /api/v1/admin/orgs/{orgId}/branches/{branchId}/table-areas | `page`, `size` |
| GET | .../table-areas/{tableAreaId} | No body |
| PATCH | .../table-areas/{tableAreaId} | `{"name": "New Name"}` |

---

## Sales – Tables (branch-scoped)

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/branches/{branchId}/tables | `{"tableAreaId": null, "name": "A-1", "capacity": 4}` |
| GET | /api/v1/admin/orgs/{orgId}/branches/{branchId}/tables | `page`, `size` |
| GET | .../tables/{tableId} | No body |
| PATCH | .../tables/{tableId} | `{"tableAreaId": null, "name": "A-1", "capacity": 4, "status": "ACTIVE"}` |

---

## Operator – Tables (list for Select Table)

| Method | Path | Body / query |
|--------|------|----------------|
| GET | /api/v1/operator/orgs/{orgId}/branches/{branchId}/tables | No body. Returns list of table entities. |

---

## Operator – Shifts

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/operator/orgs/{orgId}/branches/{branchId}/terminals/{terminalId}/shifts | `{"openingFloatAmount": 500}` |
| GET | .../shifts/current | No body |
| PATCH | .../shifts/{shiftId} | `{"closingCountedAmount": 1000}` (close shift) |

---

## Operator – Cash movements

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/operator/.../terminals/{terminalId}/cash-movements | `{"type": "PAID_IN", "amount": 100, "reasonCodeId": null}` |
| GET | .../shifts/{shiftId}/cash-movements | No body |

---

## Operator – Day close

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/operator/orgs/{orgId}/branches/{branchId}/day-close | `{"businessDate": "2026-02-28"}` |

---

## Operator – Stock count sessions (manual stock taking)

Branch-scoped. Staff must be assigned to branch. Industry standard: floor staff perform cycle counts.

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/operator/orgs/{orgId}/branches/{branchId}/stock-count-sessions | No body |
| GET | .../stock-count-sessions | `page`, `size` |
| GET | .../stock-count-sessions/{sessionId} | No body |
| POST | .../stock-count-sessions/{sessionId}/lines | `{"itemId": "<id>", "countedQty": 10}` |
| POST | .../stock-count-sessions/{sessionId}/close | No body |

---

## Operator – Sales

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/operator/.../terminals/{terminalId}/sales | `{"customerId": null, "priceListId": "<id>"}` or `{}` |
| GET | .../sales | No body (list open/held) |
| GET | .../sales/{saleId} | No body |
| POST | .../sales/{saleId}/lines | `{"itemId": "<id>", "qty": 1, "uomId": null, "unitPriceOverride": null, "modifiers": []}` |
| POST | .../sales/{saleId}/tenders | `{"tenderTypeId": "<id>", "amount": 200, "currency": "KES"}` |
| POST | .../sales/{saleId}/complete | No body |
| POST | .../sales/{saleId}/hold | No body |
| POST | .../sales/{saleId}/void | No body |
| GET | .../sales/{saleId}/receipt | No body |
| GET | .../sales/{saleId}/receipt/details | No body |

---

## M-Pesa STK Push

Public callback (no JWT): `POST /api/v1/integrations/mpesa/stk/callback` — Safaricom Daraja STK result JSON (`Body.stkCallback`).

Admin config (org-scoped):

| Method | Path | Body |
|--------|------|------|
| GET | /api/v1/admin/orgs/{orgId}/mpesa/configs | — |
| POST | /api/v1/admin/orgs/{orgId}/mpesa/configs | `{"environment":"SANDBOX","consumerKey":"…","consumerSecret":"…","passkey":"…","shortcode":"174379","tillNumber":null,"stkAutoComplete":true,"callbackBaseUrl":null}` |
| POST | /api/v1/admin/orgs/{orgId}/mpesa/configs/branches/{branchId} | Same body (branch override) |
| PATCH | /api/v1/admin/orgs/{orgId}/mpesa/configs/{configId} | Partial update; secrets masked on GET (`****1234`) |
| DELETE | /api/v1/admin/orgs/{orgId}/mpesa/configs/{configId} | Soft-deactivate |

Operator STK (JWT):

| Method | Path | Body |
|--------|------|------|
| POST | .../sales/{saleId}/mpesa/stk | `{"phoneNumber":"0712345678","amount":99.50}` |
| GET | .../sales/{saleId}/mpesa/stk/{stkRequestId} | Poll status (`PENDING` → `SUCCESS` / `FAILED` / `TIMEOUT`) |

Config resolution: active branch override, else org-default (`branch_id` null). `stkAutoComplete`: when true and STK tender ≥ sale total, callback completes the sale.

Application config (`xpos.mpesa.*`): `callback-url`, `stk-timeout-seconds` (default 120), `oauth-token-cache-seconds`, Daraja sandbox/production base URLs.

---

## Sales (admin) – List completed sales

| Method | Path | Body / query |
|--------|------|----------------|
| GET | /api/v1/admin/orgs/{orgId}/branches/{branchId}/sales | `page`, `size`, `status` (default: COMPLETED), `fromDate`, `toDate` |

---

## Cash (admin) – Shifts

| Method | Path | Body / query |
|--------|------|----------------|
| GET | /api/v1/admin/orgs/{orgId}/branches/{branchId}/shifts | `page`, `size`, `status`, `from`, `to` |

---

## Cash (admin) – Cash movements

| Method | Path | Body / query |
|--------|------|----------------|
| GET | /api/v1/admin/orgs/{orgId}/branches/{branchId}/cash-movements | `page`, `size`, `shiftId`, etc. |

---

## Cash (admin) – Day closes

| Method | Path | Body / query |
|--------|------|----------------|
| GET | /api/v1/admin/orgs/{orgId}/branches/{branchId}/day-closes | `page`, `size` |
| GET | .../day-closes/{dayCloseId} | No body |

---

## Cash (admin) – Z-report

| Method | Path | Body / query |
|--------|------|----------------|
| GET | /api/v1/admin/orgs/{orgId}/branches/{branchId}/z-report | `businessDate=2026-02-28` |

---

## Inventory – Suppliers

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/suppliers | `{"name": "Supplier A", "phone": null, "email": null}` |
| GET | /api/v1/admin/orgs/{orgId}/suppliers | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/suppliers/{supplierId} | No body |
| PATCH | /api/v1/admin/orgs/{orgId}/suppliers/{supplierId} | Same shape as create |

---

## Inventory – Purchase orders

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/purchase-orders | `{"branchId": "<id>", "supplierId": "<id>"}` |
| GET | /api/v1/admin/orgs/{orgId}/purchase-orders | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/purchase-orders/{purchaseOrderId} | No body |
| POST | .../purchase-orders/{purchaseOrderId}/lines | `{"itemId": "<id>", "qty": 10, "uomId": null, "expectedUnitCost": null}` |

---

## Inventory – Stock receipts (goods-receipt-notes API)

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/goods-receipt-notes | `{"branchId": "<id>", "supplierId": "<id>", "purchaseOrderId": null, "lines": [{"itemId": "<id>", "qty": 5, "uomId": null, "receivedUnitCost": null}]}` |
| GET | /api/v1/admin/orgs/{orgId}/goods-receipt-notes | `page`, `size`, `branchId` |
| GET | /api/v1/admin/orgs/{orgId}/goods-receipt-notes/{grnId} | No body |

---

## Inventory – Stock movements

| Method | Path | Body / query |
|--------|------|----------------|
| GET | /api/v1/admin/orgs/{orgId}/stock-movements | `page`, `size`, `branchId`, `itemId`, etc. |
| GET | /api/v1/admin/orgs/{orgId}/stock-movements/{stockMovementId} | No body |

---

## Inventory – Stock taking schedules (admin)

Daily or weekly automatic stock counts per branch. Industry standard: cycle counts on a schedule.

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/stock-taking-schedules | `{"branchId": "<id>", "frequency": "DAILY", "scheduledHour": 6, "scheduledMinute": 0}` or `{"frequency": "WEEKLY", "dayOfWeek": 1, ...}` |
| GET | /api/v1/admin/orgs/{orgId}/stock-taking-schedules | `page`, `size` |
| GET | .../stock-taking-schedules/by-branch | `branchId` (required) |
| GET | .../stock-taking-schedules/{scheduleId} | No body |
| PUT | .../stock-taking-schedules/{scheduleId} | `{"frequency", "dayOfWeek", "scheduledHour", "scheduledMinute", "isActive"}` |
| DELETE | .../stock-taking-schedules/{scheduleId} | No body |
| POST | .../stock-taking-schedules/{scheduleId}/trigger | No body. Manually run the schedule now; returns created session. |

---

## Inventory – Stock count sessions (admin)

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/stock-count-sessions | `{"branchId": "<id>"}` |
| GET | /api/v1/admin/orgs/{orgId}/stock-count-sessions | `branchId` (required), `page`, `size` |
| GET | .../stock-count-sessions/{sessionId} | No body |
| POST | .../stock-count-sessions/{sessionId}/lines | `{"itemId": "<id>", "countedQty": 10}` |
| POST | .../stock-count-sessions/{sessionId}/close | No body |

---

## Inventory – Transfer orders

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/transfer-orders | `{"fromBranchId": "<id>", "toBranchId": "<id>"}` |
| GET | /api/v1/admin/orgs/{orgId}/transfer-orders | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/transfer-orders/{transferOrderId} | No body |
| POST | .../transfer-orders/{transferOrderId}/lines | `{"itemId": "<id>", "qty": 5, "uomId": null}` |

---

## Inventory – Recipes

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/recipes | `{"menuItemId": "<itemId>", "yieldQty": 1}` |
| GET | /api/v1/admin/orgs/{orgId}/recipes | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/recipes/{recipeId} | No body |
| PATCH | /api/v1/admin/orgs/{orgId}/recipes/{recipeId} | Same shape as create |
| POST | .../recipes/{recipeId}/lines | `{"ingredientItemId": "<id>", "qty": 0.5, "uomId": null}` |

---

## Ledger – Ledger accounts

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/ledger-accounts | `{"code": "1000", "name": "Cash", "accountType": "ASSET"}` |
| GET | /api/v1/admin/orgs/{orgId}/ledger-accounts | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/ledger-accounts/{accountId} | No body |

---

## Ledger – Posting rules

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/posting-rules | `{"eventType": "SALE_COMPLETE", "debitAccountCode": "1000", "creditAccountCode": "4000"}` |
| GET | /api/v1/admin/orgs/{orgId}/posting-rules | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/posting-rules/{ruleId} | No body |

---

## Ledger – Ledger entries

| Method | Path | Body / query |
|--------|------|----------------|
| GET | /api/v1/admin/orgs/{orgId}/ledger-entries | `page`, `size`, `branchId`, `fromDate`, `toDate` |
| GET | /api/v1/admin/orgs/{orgId}/ledger-entries/{entryId} | No body |

---

## Compliance – Tax agency configs

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/tax-agency-configs | `{"name": "KRA", "vatStandardRate": 0.16, "vatReducedRate": 0.08, "supportsEtims": false}` |
| GET | /api/v1/admin/orgs/{orgId}/tax-agency-configs | `page`, `size` |
| GET | .../tax-agency-configs/{configId} | No body |
| PATCH | .../tax-agency-configs/{configId} | Same shape as create |

---

## Compliance – VSCU configs

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/vscu-configs | `{"branchId": "<id>", "configJson": {}}` |
| GET | /api/v1/admin/orgs/{orgId}/vscu-configs | `page`, `size` |
| GET | .../vscu-configs/{configId} | No body |
| PATCH | .../vscu-configs/{configId} | Same shape as create |

---

## Compliance – eTIMS invoice records

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/branches/{branchId}/etims-invoice-records | `{"saleId": "<id>"}` (or as per DTO) |
| GET | .../etims-invoice-records | `page`, `size` |
| GET | .../etims-invoice-records/{recordId} | No body |
| POST | .../etims-invoice-records/{recordId}/submit | No body |
| POST | .../etims-invoice-records/{recordId}/poll-status | No body |

---

## Fraud – Reason codes

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/reason-codes | `{"code": "VOID", "description": "Void reason"}` |
| GET | /api/v1/admin/orgs/{orgId}/reason-codes | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/reason-codes/{reasonCodeId} | No body |
| PATCH | /api/v1/admin/orgs/{orgId}/reason-codes/{reasonCodeId} | Same shape as create |

---

## Fraud – Approval policies

| Method | Path | Body / query |
|--------|------|----------------|
| POST | /api/v1/admin/orgs/{orgId}/approval-policies | `{"branchId": null, "policyCode": "VOID", "thresholdValue": null, "requiresManager": true}` |
| GET | /api/v1/admin/orgs/{orgId}/approval-policies | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/approval-policies/{policyId} | No body |

---

## Fraud – Approval events

| Method | Path | Body / query |
|--------|------|----------------|
| GET | /api/v1/admin/orgs/{orgId}/branches/{branchId}/approval-events | `page`, `size` |
| GET | .../approval-events/{eventId} | No body |

---

## Audit – Audit logs

| Method | Path | Body / query |
|--------|------|----------------|
| GET | /api/v1/admin/orgs/{orgId}/audit-logs | `page`, `size`, `branchId`, `from`, `to` |
| GET | /api/v1/admin/orgs/{orgId}/audit-logs/{logId} | No body |

---

## Audit – Audit vault records

| Method | Path | Body / query |
|--------|------|----------------|
| GET | /api/v1/admin/orgs/{orgId}/audit-vault-records | `page`, `size`, `branchId` |
| GET | /api/v1/admin/orgs/{orgId}/audit-vault-records/{recordId} | No body |

---

## Audit – Outbox events

| Method | Path | Body / query |
|--------|------|----------------|
| GET | /api/v1/admin/orgs/{orgId}/outbox-events | `page`, `size` |
| GET | /api/v1/admin/orgs/{orgId}/outbox-events/{eventId} | No body |
