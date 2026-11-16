---
name: xpos-java-patterns
description: XPOS Spring Boot patterns — layering, Flyway, MapStruct, Lombok, org scoping, outbox. Use when implementing or reviewing Java backend code in xpos.
---

# XPOS Java Patterns

Hard constraints and full workflow: see `.cursor/rules/project.mdc`.

## Layering

`domain/` → `repository/` → `service/` → `service/impl/` → `mapper/` → `api/v1/admin/{module}/`

- Controllers thin; business logic in services with `@Transactional`.
- Request/response DTOs only at API boundary — never expose lazy entity graphs.

## Repository

- Org-scoped JPQL; camelCase method names (no underscores like `findByOrg_Id`).
- Text blocks: opening `"""` must be followed by a newline.
- JOIN FETCH associations used when mapping entity → DTO in controller.

## MapStruct & Lombok

- `@Mapper(componentModel = "spring")` in `{module}/mapper/`.
- Partial updates: `@BeanMapping(nullValuePropertyMappingStrategy = IGNORE)`.
- Entities: `@Getter`/`@Setter` (avoid `@Data` on JPA entities).
- DTOs: `@Builder` when many fields; `@Slf4j` for logging.

## Database

- Flyway only — no Hibernate DDL.
- Map constraint violations via `ConstraintMessageCatalog`.
- No `org.postgresql.util.PSQLException` in app code.

## Security

- JWT `sub` = `iamUserId`; Keycloak external — no login flows in XPOS.
- Operator endpoints: `requireStaffUserForBranch(orgId, branchId, iamUserId)`.
