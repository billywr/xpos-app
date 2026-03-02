# XPOS E2E Postman - Short summary

If the full guide does not preview (webview error), use this file to preview. Full JSON bodies are in **E2E_POSTMAN_GUIDE.md**.

---

## Run the project

- **Prerequisites:** Java 21, Maven, PostgreSQL (`xpos_dev`), Redis, Keycloak
- **Start:** `mvn spring-boot:run -Dspring-boot.run.profiles=dev`
- **Base URL:** http://localhost:9003
- **Auth:** Bearer JWT (Keycloak). Use JWT `sub` as staff `iamUserId`.

---

## E2E steps (order)

| Step | Method | Path |
|------|--------|------|
| 1 | GET | /api/v1/health/ping |
| 2 | POST | /api/v1/admin/orgs |
| 3 | POST | /api/v1/admin/orgs/{orgId}/businesses |
| 4 | POST | /api/v1/admin/orgs/{orgId}/branches |
| 5 | POST | /api/v1/admin/orgs/{orgId}/branches/{branchId}/terminals |
| 6a | POST | .../branches/{branchId}/devices/register |
| 6b | POST | .../terminals/{terminalId}/bind-device |
| 7a | POST | /api/v1/admin/orgs/{orgId}/staff-users |
| 7b | PUT | .../staff-users/{staffUserId}/profile |
| 7c | POST | .../staff-users/{staffUserId}/branches |
| 8a | POST | /api/v1/admin/orgs/{orgId}/categories |
| 8b | POST | .../uoms |
| 8c | POST | .../tax-profiles |
| 8d | POST | .../items |
| 9a | POST | .../price-lists |
| 9b | POST | .../price-lists/{priceListId}/items |
| 10 | POST | .../tender-types |
| 11 | POST | /api/v1/operator/.../terminals/{terminalId}/shifts |
| 12 | POST | .../sales |
| 13 | POST | .../sales/{saleId}/lines |
| 14 | POST | .../sales/{saleId}/tenders |
| 15 | POST | .../sales/{saleId}/complete |
| 16 | GET | .../sales/{saleId}/receipt |

Save `id` from each response as orgId, businessId, branchId, terminalId, etc.

---

## Example bodies (see full guide for all)

- **Org:** `{"name": "My Bar & Restaurant"}`
- **Business:** `{"legalName": "My Bar Ltd", "kraPin": "P051234567X"}`
- **Branch:** `{"businessId": "<uuid>", "name": "Main Branch", "timezone": "Africa/Nairobi", "currency": "KES"}`
- **Terminal:** `{"terminalCode": "T1"}`
- **Sale:** `{"customerId": null, "priceListId": "<uuid>"}`
- **Line:** `{"itemId": "<uuid>", "qty": 1, "modifiers": []}`
- **Tender:** `{"tenderTypeId": "<uuid>", "amount": 200, "currency": "KES"}`

---

## Fix preview in the IDE

The message "Error loading webview: Could not register service worker" comes from the editor, not the Markdown file.

1. **Reload window:** Command Palette (Ctrl+Shift+P) → "Developer: Reload Window"
2. **Try the other preview:** Right-click the tab → "Open Preview" or use the preview icon
3. **Open in browser:** Right-click file → "Reveal in File Explorer", then open the .md file in Chrome/Firefox
4. **Use this summary:** Open **E2E_POSTMAN_GUIDE_SUMMARY.md** and preview it; it is shorter and may render when the long guide does not

Full request/response details: **E2E_POSTMAN_GUIDE.md**
