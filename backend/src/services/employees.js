const { query } = require("../db");
const { badRequest, notFound } = require("../utils/errors");
const { recordAuditLog } = require("./audit");
const fs = require("fs");
const path = require("path");

// ─── Persistent in-memory fallback store ───────────────────────────────────
// Employees are saved to a JSON file so they survive server restarts.
const STORE_PATH = path.join(__dirname, "../../data/employees_store.json");

function loadStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf8");
      return JSON.parse(raw);
    }
  } catch (_) {}
  return { employees: [], nextId: 1 };
}

function saveStore() {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(mem, null, 2), "utf8");
  } catch (_) {}
}

const mem = loadStore();

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

function normalizeEmployeePayload(payload) {
  const p = payload || {};
  return {
    firstName: p.firstName || p.first_name,
    lastName: p.lastName || p.last_name,
    email: p.email,
    hireDate: p.hireDate || p.hire_date,
    status: p.status,
    departmentId: p.departmentId || p.department_id,
    departmentName: p.departmentName || p.department_name,
    jobTitle: p.jobTitle || p.job_title,
    baseSalary: p.baseSalary || p.base_salary,
    userId: p.userId || p.user_id,
    hourlyRate: p.hourlyRate || p.hourly_rate || (p.base_salary ? Number(p.base_salary) / 160 : undefined),
    overtimeMultiplier: p.overtimeMultiplier || p.overtime_multiplier
  };
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
  const data = normalizeEmployeePayload(payload);
  requireField(data.firstName, "firstName");
  requireField(data.lastName, "lastName");
  requireField(data.hireDate, "hireDate");

  const hourlyRate = parseNumber(data.hourlyRate, "hourlyRate");
  const overtimeMultiplier = parseNumber(data.overtimeMultiplier, "overtimeMultiplier");

  try {
    const result = await query(
      `INSERT INTO employees
        (user_id, department_id, first_name, last_name, email, status, hire_date, hourly_rate, overtime_multiplier)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 0), COALESCE($9, 1.5))
       RETURNING *`,
      [
        data.userId || null,
        data.departmentId || null,
        data.firstName,
        data.lastName,
        normalizeEmail(data.email),
        data.status || "active",
        data.hireDate,
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
      user_id: data.userId || null,
      department_id: data.departmentId || null,
      department_name: data.departmentName || null,
      first_name: data.firstName,
      last_name: data.lastName,
      email: normalizeEmail(data.email),
      status: data.status || "active",
      hire_date: data.hireDate,
      job_title: data.jobTitle || null,
      base_salary: data.baseSalary || null,
      hourly_rate: hourlyRate,
      overtime_multiplier: overtimeMultiplier || 1.5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mem.employees.unshift(employee);
    saveStore();
    return employee;
  }
}

async function updateEmployee(id, payload, actorUserId) {
  const data = normalizeEmployeePayload(payload);
  const fields = [];
  const values = [];

  if (data.firstName !== undefined) {
    values.push(data.firstName);
    fields.push(`first_name = $${values.length}`);
  }
  if (data.lastName !== undefined) {
    values.push(data.lastName);
    fields.push(`last_name = $${values.length}`);
  }
  if (data.email !== undefined) {
    values.push(normalizeEmail(data.email));
    fields.push(`email = $${values.length}`);
  }
  if (data.departmentId !== undefined) {
    values.push(data.departmentId || null);
    fields.push(`department_id = $${values.length}`);
  }
  if (data.userId !== undefined) {
    values.push(data.userId || null);
    fields.push(`user_id = $${values.length}`);
  }
  if (data.status !== undefined) {
    values.push(data.status);
    fields.push(`status = $${values.length}`);
  }
  if (data.hireDate !== undefined) {
    values.push(data.hireDate);
    fields.push(`hire_date = $${values.length}`);
  }
  if (data.hourlyRate !== undefined) {
    values.push(parseNumber(data.hourlyRate, "hourlyRate"));
    fields.push(`hourly_rate = COALESCE($${values.length}, hourly_rate)`);
  }
  if (data.overtimeMultiplier !== undefined) {
    values.push(parseNumber(data.overtimeMultiplier, "overtimeMultiplier"));
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
    if (data.firstName !== undefined) emp.first_name = data.firstName;
    if (data.lastName  !== undefined) emp.last_name  = data.lastName;
    if (data.email     !== undefined) emp.email      = normalizeEmail(data.email);
    if (data.status    !== undefined) emp.status     = data.status;
    if (data.hireDate  !== undefined) emp.hire_date  = data.hireDate;
    emp.updated_at = new Date().toISOString();
    saveStore();
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
    saveStore();
  }
}

module.exports = {
  listEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee
};
