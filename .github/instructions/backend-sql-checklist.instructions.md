---
description: "Use when implementing backend APIs, services, and SQL data layer for payroll_system. Includes a phase-by-phase backend + SQL checklist."
name: "Payroll Backend + SQL Checklist"
applyTo: "**"
---
# Payroll Backend + SQL Checklist

- [x] **Phase 1: Backend foundation (API skeleton, no DB)**
  - [x] Define API base path and versioning (e.g., `/api/v1`).
  - [x] Add config loading, environment validation, and structured logging.
  - [x] Implement error handling middleware and consistent error response format.
  - [x] Add health and readiness endpoints.
  - [x] Define auth flow (JWT or session), password hashing, and role model.
  - [x] Establish core roles (admin, hr, payroll, manager, employee).
  - [x] Create API route placeholders aligned to existing pages:
    - [x] auth/login
    - [x] auth/logout
    - [x] auth/me
    - [x] employees
    - [x] attendance
    - [x] payroll
    - [x] tax
    - [x] staff
    - [x] analytics
    - [x] dashboard
  - [x] Document request/response payloads and status codes for each route.

- [x] **Phase 2: SQL foundation (schema + migrations)**
  - [x] Create migrations for tables:
    - [x] users
    - [x] roles
    - [x] user_roles
    - [x] employees
    - [x] departments
    - [x] attendance
    - [x] time_entries
    - [x] pay_periods
    - [x] payroll_runs
    - [x] payroll_items
    - [x] taxes
    - [x] deductions
    - [x] benefits
    - [x] audit_logs
  - [x] Add primary keys, foreign keys, and unique constraints.
  - [x] Add indexes for common queries (employee_id, pay_period_id, created_at).
  - [x] Seed minimal lookup data (roles, departments, tax brackets).
  - [x] Add a migration rollback strategy and document how to apply/revert.

- [x] **Phase 3: Core domain logic (DB-backed)**
  - [x] Implement CRUD for employees and staff records with validation.
  - [x] Implement attendance capture and approval flows.
  - [x] Implement payroll calculation pipeline:
    - [x] base pay
    - [x] overtime
    - [x] deductions
    - [x] taxes
    - [x] net pay
    - [x] idempotency for payroll runs and safe re-runs
    - [x] transactional boundaries per payroll run
  - [x] Implement tax rules and configurable rates by pay period.
  - [x] Add audit logging for payroll changes and approvals.

- [ ] **Phase 4: Reporting and exports**
  - [ ] Build analytics endpoints for dashboard and payroll summaries.
  - [ ] Implement tax reports and payroll run exports (CSV/JSON).
  - [ ] Add filtering, pagination, and date-range queries.
  - [ ] Ensure reports use read-only queries and safe timeouts.

- [ ] **Phase 5: Hardening and quality**
  - [ ] Add input validation and request rate limits.
  - [ ] Add RBAC checks for every route.
  - [ ] Add integration tests for payroll runs and tax reports.
  - [ ] Add backup/restore notes and basic monitoring metrics.
  - [ ] Document local setup, migrations, and test commands.

## Definition of Done

- [ ] All routes required by the existing HTML pages return real data.
- [ ] Payroll runs are deterministic, audited, and transactional.
- [ ] Database schema is normalized and migration-safe.
- [ ] Auth and RBAC are enforced for every endpoint.
- [ ] Critical workflows have integration tests.
