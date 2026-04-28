# Payroll Backend (Phases 1-2)

This backend provides the API skeleton for payroll_system plus SQL migrations for the initial schema.

## Setup (Phases 1-2)

1. Install dependencies.
2. Create a local `.env` from the example and set `JWT_SECRET` and `DATABASE_URL`.

## Run

```powershell
Set-Location backend
Copy-Item .env.example .env
# Edit .env and set JWT_SECRET and DATABASE_URL
npm install
npm start
```

## Smoke test

```powershell
Set-Location backend
npm test
```

## Migrations

```powershell
Set-Location backend
Copy-Item .env.example .env
# Edit .env and set DATABASE_URL
npm run migrate:status
npm run migrate:up
```

Rollback one step:

```powershell
Set-Location backend
npm run migrate:down
```

## Default test user

- Email: admin@payroll.test
- Password: password123
