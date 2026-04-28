const { query } = require("../db");
const { badRequest, notFound } = require("../utils/errors");
const { recordAuditLog } = require("./audit");

// ─── In-memory fallback store (used when PostgreSQL is unavailable) ───
const mem = { employees: [], nextId: 1 };

function isDbDown(err) {
  if (!err) return false;
  if (err.code === "ECONNREFUSED") return true;
  if (Array.isArray(err.errors)) return err.errors.some(e => e && e.code === "ECONNREFUSED");
  return false;
}

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
  try {
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
  } catch (err) {
    if (!isDbDown(err)) throw err;
    // In-memory fallback
    let rows = [...mem.employees];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter(e =>
        (e.first_name || "").toLowerCase().includes(q) ||
        (e.last_name  || "").toLowerCase().includes(q) ||
        (e.email      || "").toLowerCase().includes(q)
      );
    }
    if (filters.status) rows = rows.filter(e => e.status === filters.status);
    return rows.slice(filters.offset || 0, (filters.offset || 0) + (filters.limit || 50));
  }
}

async function getEmployeeById(id) {
  try {
    const result = await query(
      `SELECT employees.*, departments.name AS department_name
       FROM employees
       LEFT JOIN departments ON employees.department_id = departments.id
       WHERE employees.id = $1`,
      [id]
    );
    if (result.rowCount === 0) throw notFound("Employee not found", "employee_not_found");
    return result.rows[0];
  } catch (err) {
    if (!isDbDown(err)) throw err;
    const emp = mem.employees.find(e => String(e.id) === String(id));
    if (!emp) throw notFound("Employee not found", "employee_not_found");
    return emp;
  }
}

async function createEmployee(payload, actorUserId) {
  requireField(payload.firstName, "firstName");
  requireField(payload.lastName, "lastName");
  requireField(payload.hireDate, "hireDate");

  const hourlyRate = parseNumber(payload.hourlyRate, "hourlyRate");
  const overtimeMultiplier = parseNumber(payload.overtimeMultiplier, "overtimeMultiplier");

  try {
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
  } catch (err) {
    if (!isDbDown(err)) throw err;
    // In-memory fallback
    const employee = {
      id: "mem_" + (mem.nextId++),
      user_id: payload.userId || null,
      department_id: payload.departmentId || null,
      department_name: payload.departmentName || null,
      first_name: payload.firstName,
      last_name: payload.lastName,
      email: normalizeEmail(payload.email),
      status: payload.status || "active",
      hire_date: payload.hireDate,
      job_title: payload.jobTitle || null,
      base_salary: payload.baseSalary || null,
      hourly_rate: hourlyRate,
      overtime_multiplier: overtimeMultiplier || 1.5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mem.employees.unshift(employee);
    return employee;
  }
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

  try {
    values.push(id);
    const result = await query(
      `UPDATE employees
       SET ${fields.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );
    if (result.rowCount === 0) throw notFound("Employee not found", "employee_not_found");
    const employee = result.rows[0];
    await recordAuditLog({
      actorUserId,
      action: "employee_updated",
      entityType: "employee",
      entityId: String(employee.id)
    });
    return employee;
  } catch (err) {
    if (!isDbDown(err)) throw err;
    // In-memory fallback
    const emp = mem.employees.find(e => String(e.id) === String(id));
    if (!emp) throw notFound("Employee not found", "employee_not_found");
    if (payload.firstName !== undefined) emp.first_name = payload.firstName;
    if (payload.lastName  !== undefined) emp.last_name  = payload.lastName;
    if (payload.email     !== undefined) emp.email      = normalizeEmail(payload.email);
    if (payload.status    !== undefined) emp.status     = payload.status;
    if (payload.hireDate  !== undefined) emp.hire_date  = payload.hireDate;
    emp.updated_at = new Date().toISOString();
    return emp;
  }
}

async function deleteEmployee(id, actorUserId) {
  try {
    const result = await query("DELETE FROM employees WHERE id = $1 RETURNING id", [id]);
    if (result.rowCount === 0) throw notFound("Employee not found", "employee_not_found");
    await recordAuditLog({
      actorUserId,
      action: "employee_deleted",
      entityType: "employee",
      entityId: String(id)
    });
  } catch (err) {
    if (!isDbDown(err)) throw err;
    // In-memory fallback
    const idx = mem.employees.findIndex(e => String(e.id) === String(id));
    if (idx === -1) throw notFound("Employee not found", "employee_not_found");
    mem.employees.splice(idx, 1);
  }
}

module.exports = {
  listEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee
};
