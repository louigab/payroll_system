const { query } = require("../db");
const { badRequest, notFound } = require("../utils/errors");
const { recordAuditLog } = require("./audit");

function normalizeEmail(email) {
  return email ? String(email).trim().toLowerCase() : "";
}

function parseNumber(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw badRequest(`Invalid ${fieldName}`, "invalid_number");
  }
  return parsed;
}

function requireField(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw badRequest(`${fieldName} is required`, "missing_field");
  }
}

async function listEmployees(filters) {
  const conditions = [];
  const values = [];

  if (filters.search) {
    values.push(`%${filters.search.toLowerCase()}%`);
    conditions.push(
      `(LOWER(employees.first_name) LIKE $${values.length} OR ` +
        `LOWER(employees.last_name) LIKE $${values.length} OR ` +
        `LOWER(employees.email) LIKE $${values.length})`
    );
  }

  if (filters.departmentId) {
    values.push(filters.departmentId);
    conditions.push(`employees.department_id = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`employees.status = $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  values.push(filters.limit);
  const limitIndex = values.length;
  values.push(filters.offset);
  const offsetIndex = values.length;

  const result = await query(
    `SELECT employees.*, departments.name AS department_name
     FROM employees
     LEFT JOIN departments ON employees.department_id = departments.id
     ${whereClause}
     ORDER BY employees.created_at DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    values
  );

  return result.rows;
}

async function getEmployeeById(id) {
  const result = await query(
    `SELECT employees.*, departments.name AS department_name
     FROM employees
     LEFT JOIN departments ON employees.department_id = departments.id
     WHERE employees.id = $1`,
    [id]
  );

  if (result.rowCount === 0) {
    throw notFound("Employee not found", "employee_not_found");
  }

  return result.rows[0];
}

async function createEmployee(payload, actorUserId) {
  requireField(payload.firstName, "firstName");
  requireField(payload.lastName, "lastName");
  requireField(payload.email, "email");
  requireField(payload.hireDate, "hireDate");

  const hourlyRate = parseNumber(payload.hourlyRate, "hourlyRate");
  const overtimeMultiplier = parseNumber(payload.overtimeMultiplier, "overtimeMultiplier");

  const result = await query(
    `INSERT INTO employees
      (user_id, department_id, first_name, last_name, email, status, hire_date, hourly_rate, overtime_multiplier)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 0), COALESCE($9, 1.5))
     RETURNING *`,
    [
      payload.userId || null,
      payload.departmentId || null,
      payload.firstName,
      payload.lastName,
      normalizeEmail(payload.email),
      payload.status || "active",
      payload.hireDate,
      hourlyRate,
      overtimeMultiplier
    ]
  );

  const employee = result.rows[0];
  await recordAuditLog({
    actorUserId,
    action: "employee_created",
    entityType: "employee",
    entityId: String(employee.id),
    metadata: { email: employee.email }
  });

  return employee;
}

async function updateEmployee(id, payload, actorUserId) {
  const fields = [];
  const values = [];

  if (payload.firstName !== undefined) {
    values.push(payload.firstName);
    fields.push(`first_name = $${values.length}`);
  }
  if (payload.lastName !== undefined) {
    values.push(payload.lastName);
    fields.push(`last_name = $${values.length}`);
  }
  if (payload.email !== undefined) {
    values.push(normalizeEmail(payload.email));
    fields.push(`email = $${values.length}`);
  }
  if (payload.departmentId !== undefined) {
    values.push(payload.departmentId || null);
    fields.push(`department_id = $${values.length}`);
  }
  if (payload.userId !== undefined) {
    values.push(payload.userId || null);
    fields.push(`user_id = $${values.length}`);
  }
  if (payload.status !== undefined) {
    values.push(payload.status);
    fields.push(`status = $${values.length}`);
  }
  if (payload.hireDate !== undefined) {
    values.push(payload.hireDate);
    fields.push(`hire_date = $${values.length}`);
  }
  if (payload.hourlyRate !== undefined) {
    values.push(parseNumber(payload.hourlyRate, "hourlyRate"));
    fields.push(`hourly_rate = COALESCE($${values.length}, hourly_rate)`);
  }
  if (payload.overtimeMultiplier !== undefined) {
    values.push(parseNumber(payload.overtimeMultiplier, "overtimeMultiplier"));
    fields.push(`overtime_multiplier = COALESCE($${values.length}, overtime_multiplier)`);
  }

  if (fields.length === 0) {
    throw badRequest("No updates provided", "missing_updates");
  }

  values.push(id);
  const result = await query(
    `UPDATE employees
     SET ${fields.join(", ")}, updated_at = NOW()
     WHERE id = $${values.length}
     RETURNING *`,
    values
  );

  if (result.rowCount === 0) {
    throw notFound("Employee not found", "employee_not_found");
  }

  const employee = result.rows[0];
  await recordAuditLog({
    actorUserId,
    action: "employee_updated",
    entityType: "employee",
    entityId: String(employee.id)
  });

  return employee;
}

async function deleteEmployee(id, actorUserId) {
  const result = await query("DELETE FROM employees WHERE id = $1 RETURNING id", [id]);

  if (result.rowCount === 0) {
    throw notFound("Employee not found", "employee_not_found");
  }

  await recordAuditLog({
    actorUserId,
    action: "employee_deleted",
    entityType: "employee",
    entityId: String(id)
  });
}

module.exports = {
  listEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee
};
