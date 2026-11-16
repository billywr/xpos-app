# Running XPOS in IntelliJ IDEA

## 1. Use the `dev` profile

The app expects the **dev** profile so it loads:

- PostgreSQL URL: `jdbc:postgresql://localhost:5432/xpos_dev`
- Hikari pool settings (avoids "Maximum pool size: undefined/unknown")
- Flyway migrations
- Dev settings

**Option A – Default (recommended)**  
The project has a small `application.yml` that sets `spring.profiles.active: dev` when no profile is set. So you can run `XposApplication` from IntelliJ without changing anything.

**Option B – Set profile in Run Configuration**  
If you prefer to set it explicitly:

1. Run → Edit Configurations
2. Select your **Application** run for `XposApplication`
3. In **Active profiles**, enter: `dev`
4. Apply and run

## 2. Database must exist and be migrated

**"Schema validation: missing table [approval_event]"** means Hibernate is validating the schema but the database either:

- Has not had Flyway migrations run, or
- Is a different/empty database

**Do this:**

1. **Create the database** (once):

   ```bash
   psql -U postgres -c "CREATE DATABASE xpos_dev;"
   ```

2. **Run Flyway migrations** (once per empty DB):

   ```bash
   cd /home/billy/data/internals/xpos
   mvn flyway:migrate -Dflyway.url=jdbc:postgresql://localhost:5432/xpos_dev \
     -Dflyway.user=postgres -Dflyway.password=root
   ```

   Or start the app once with the dev profile and let Spring Boot run Flyway on startup (if the DB is empty, Flyway will create all tables).

3. **PostgreSQL** must be running on `localhost:5432` with user `postgres` and password `root` (or adjust `application-dev.yml` to match your setup).

## Summary

| Issue | Fix |
|-------|-----|
| Maximum pool size: undefined/unknown | Use `dev` profile (default `application.yml` does this). |
| Schema validation: missing table [approval_event] | Create DB `xpos_dev`, run Flyway migrations, then run the app. |
