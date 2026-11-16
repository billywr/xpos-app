---
name: xpos-production-safety
description: Safety protocol protecting live production servers — strictly forbids updating, adding data, or deleting data on live/production servers.
---

# Production / Live Server Safety Protocol

Use this skill whenever interacting with remote backend infrastructure or environment configurations to ensure zero live data tampering.

## Core Rules

1. **Live Host Identification**:
   - Any remote IP or domain (e.g. `https://62.169.22.51:9005`, `https://62.169.22.51:8443`) is a **LIVE PRODUCTION SERVER**.
   
2. **Strict Prohibition on Mutations**:
   - **Never update** anything on the live server.
   - **Never add new information** or create records on the live server (no POST/PUT/PATCH mutations).
   - **Never delete** data from the live server (no DELETE requests, drops, or truncates).

3. **Environments & Testing**:
   - All tests, manual API experiments, and database scripts must be run against local instances:
     - Backend: `http://localhost:9003`
     - Keycloak: `http://localhost:8088`
     - Database: local Docker PostgreSQL (`localhost:5432`)
   - Read-only inspection (non-mutating `GET` requests) is only permitted for contract verification when explicitly requested, with zero state modification.
