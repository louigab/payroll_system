# Payroll API v1 (Phase 3)

Base path: `/api/v1`

Most endpoints require `Authorization: Bearer <token>`.

## Error format

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "requestId": "string"
  }
}
```

## Health

- `GET /health`
  - 200 OK
  - Response:
    ```json
    {
      "status": "ok",
      "timestamp": "2026-04-28T12:00:00.000Z",
      "uptimeSeconds": 1234
    }
    ```

- `GET /ready`
  - 200 OK
  - Response:
    ```json
    {
      "status": "ready",
      "timestamp": "2026-04-28T12:00:00.000Z"
    }
    ```

## Auth

- `POST /auth/login`
  - 200 OK, 400 Bad Request, 401 Unauthorized
  - Request:
    ```json
    {
      "email": "admin@payroll.test",
      "password": "password123"
    }
    ```
  - Response:
    ```json
    {
      "data": {
        "accessToken": "<jwt>",
        "tokenType": "Bearer",
        "expiresIn": 28800,
        "user": {
          "id": "u_1",
          "email": "admin@payroll.test",
          "roles": ["admin", "payroll"]
        }
      }
    }
    ```

- `POST /auth/logout`
  - 204 No Content

- `GET /auth/me`
  - 200 OK, 401 Unauthorized
  - Response:
    ```json
    {
      "data": {
        "user": {
          "sub": "u_1",
          "email": "admin@payroll.test",
          "roles": ["admin", "payroll"]
        }
      }
    }
    ```

## Employees

- `GET /employees`
  - Query: `search`, `departmentId`, `status`, `limit`, `offset`

- `POST /employees`
  - Request:
    ```json
    {
      "firstName": "Ava",
      "lastName": "Stone",
      "email": "ava.stone@payroll.test",
      "hireDate": "2026-04-01",
      "departmentId": 1,
      "hourlyRate": 35,
      "overtimeMultiplier": 1.5
    }
    ```

- `GET /employees/:id`
- `PUT /employees/:id`
- `DELETE /employees/:id`

## Staff

Staff endpoints mirror employees and are backed by the same data.

- `GET /staff`
- `POST /staff`
- `GET /staff/:id`
- `PUT /staff/:id`
- `DELETE /staff/:id`

## Attendance

- `GET /attendance`
  - Query: `employeeId`, `status`, `startDate`, `endDate`, `limit`, `offset`

- `POST /attendance`
  - Request:
    ```json
    {
      "employeeId": 1,
      "attendanceDate": "2026-04-20",
      "status": "pending"
    }
    ```

- `PATCH /attendance/:id/approve`
- `PATCH /attendance/:id/reject`

### Time entries

- `GET /attendance/time-entries`
  - Query: `employeeId`, `startDate`, `endDate`, `limit`, `offset`

- `POST /attendance/time-entries`
  - Request:
    ```json
    {
      "employeeId": 1,
      "clockIn": "2026-04-20T09:00:00Z",
      "clockOut": "2026-04-20T17:30:00Z"
    }
    ```

## Payroll

- `GET /payroll/periods`
- `POST /payroll/periods`
  - Request:
    ```json
    {
      "startDate": "2026-04-01",
      "endDate": "2026-04-15",
      "status": "open"
    }
    ```

- `GET /payroll/periods/:id`
- `GET /payroll/runs`
  - Query: `payPeriodId`

- `POST /payroll/runs`
  - Headers: `Idempotency-Key: <uuid>` (optional)
  - Request:
    ```json
    {
      "payPeriodId": 1,
      "runDate": "2026-04-16"
    }
    ```

- `GET /payroll/runs/:id`
- `GET /payroll/runs/:id/items`

## Tax rates

- `GET /tax/rates`
  - Query: `effectiveFrom`, `effectiveTo`

- `POST /tax/rates`
  - Request:
    ```json
    {
      "name": "federal_standard",
      "rate": 0.22,
      "effectiveFrom": "2026-01-01",
      "effectiveTo": null
    }
    ```

## Placeholders

- `GET /analytics`
- `GET /dashboard`
