# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

---

## ⚠️ CRITICAL RULE: LIVE / PRODUCTION SERVER SAFETY
- Remote hosts (e.g. `https://62.169.22.51:9005`, Keycloak `https://62.169.22.51:8443`) are **LIVE PRODUCTION SERVERS**.
- **NEVER** update anything on the live server.
- **NEVER** add new information or create records on the live server (no POST/PUT/PATCH mutations).
- **NEVER** delete data from the live server (no DELETE requests).
- All destructive tests or mutation experiments must be executed on local instances or local SQLite databases.

