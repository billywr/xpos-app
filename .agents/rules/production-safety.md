---
description: Strict protection for live production servers — never update, add info, or delete data on live/prod servers.
---

# Production / Live Server Safety Rule

> [!CAUTION]
> **ABSOLUTE PROHIBITION ON PRODUCTION / LIVE SERVER MUTATIONS**

1. **Production Identification**:
   - Remote backend hosts (e.g. `https://62.169.22.51:9005`, Keycloak `https://62.169.22.51:8443`, or any non-localhost/non-docker container endpoint) are **STRICT PRODUCTION SERVERS**.

2. **Never Update Anything on Live Server**:
   - Do NOT execute `PUT` or `PATCH` requests against live production endpoints.
   - Do NOT run `UPDATE` statements or mutations on live databases.

3. **Never Add New Info to Live Server**:
   - Do NOT execute `POST` requests or creation endpoints against the live production server (e.g. creating test items, test users, test sales, test GRNs, test orgs).
   - Do NOT run `INSERT` statements into live production databases.

4. **Never Delete Data from Live Server**:
   - Do NOT execute `DELETE` requests against live production endpoints.
   - Do NOT run `DELETE`, `TRUNCATE`, `DROP`, or cleanup scripts against live production databases.

5. **Local-Only Testing and Development**:
   - All tests, migrations, data fixtures, and mutations MUST be targeted exclusively at local environments (e.g. `http://localhost:9003`, `http://localhost:8088`, local Docker PostgreSQL, or local SQLite).
   - Only strictly read-only inspection (safe `GET` queries) is permitted when diagnosing API contract shapes, and even then, zero mutations are allowed.
