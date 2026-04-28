# Migrations

Migrations are managed with `node-pg-migrate` and live in `backend/db/migrations`.

## Apply

```powershell
Set-Location backend
Copy-Item .env.example .env
# Edit .env and set DATABASE_URL
npm run migrate:up
```

## Rollback (one step)

```powershell
Set-Location backend
npm run migrate:down
```

## Status

```powershell
Set-Location backend
npm run migrate:status
```

## Create a new migration

```powershell
Set-Location backend
npm run migrate:create -- add_table_example
```

## Rollback strategy

- Use `migrate:down` to revert one migration at a time.
- Each migration includes a matching `down` step that reverses the `up` changes.
- Prefer small, single-purpose migrations so rollback scope is predictable.
