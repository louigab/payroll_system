const { query } = require("../db");
const { badRequest, notFound } = require("../utils/errors");
const { recordAuditLog } = require("./audit");
const fs   = require("fs");
const path = require("path");

// ── In-memory fallback store ────────────────────────────────────────────────
const STORE_PATH = path.join(__dirname, "../../data/attendance_store.json");

function loadStore() {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")); } catch (_) { return { records: [], nextId: 1 }; }
}
function saveStore(store) {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  } catch (_) {}
}
const mem = loadStore();
// ───────────────────────────────────────────────────────────────────────────

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

async function listAttendance(filters) {
  // ── Try DB first ────────────────────────────────────────────────────────
  try {
    const conditions = [];
    const values = [];

    if (filters.employeeId) {
      values.push(filters.employeeId);
      conditions.push(`attendance.employee_id = $${values.length}`);
    }
    if (filters.status) {
      values.push(filters.status);
      conditions.push(`attendance.status = $${values.length}`);
    }
    if (filters.startDate) {
      values.push(filters.startDate);
      conditions.push(`attendance.attendance_date >= $${values.length}`);
    }
    if (filters.endDate) {
      values.push(filters.endDate);
      conditions.push(`attendance.attendance_date <= $${values.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    values.push(filters.limit);
    const limitIndex = values.length;
    values.push(filters.offset);
    const offsetIndex = values.length;

    const result = await query(
      `SELECT attendance.*, employees.first_name, employees.last_name
       FROM attendance
       JOIN employees ON attendance.employee_id = employees.id
       ${whereClause}
       ORDER BY attendance.attendance_date DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values
    );
    return result.rows;
  } catch (_) {
    // ── In-memory fallback ───────────────────────────────────────────────
    let rows = mem.records;
    if (filters.employeeId) rows = rows.filter(r => String(r.employee_id) === String(filters.employeeId));
    if (filters.status)     rows = rows.filter(r => r.status === filters.status);
    if (filters.startDate)  rows = rows.filter(r => r.attendance_date >= filters.startDate);
    if (filters.endDate)    rows = rows.filter(r => r.attendance_date <= filters.endDate);
    rows = rows.slice(Number(filters.offset) || 0, (Number(filters.offset) || 0) + (Number(filters.limit) || 50));
    return rows;
  }
}

async function createAttendance(payload, actorUserId) {
  requireField(payload.employeeId, "employeeId");
  requireField(payload.attendanceDate, "attendanceDate");
  requireField(payload.status, "status");

  // ── Try DB first ────────────────────────────────────────────────────────
  try {
    const result = await query(
      `INSERT INTO attendance (employee_id, attendance_date, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [payload.employeeId, payload.attendanceDate, payload.status]
    );
    const attendance = result.rows[0];
    await recordAuditLog({
      actorUserId,
      action: "attendance_created",
      entityType: "attendance",
      entityId: String(attendance.id)
    });
    return attendance;
  } catch (_) {
    // ── In-memory fallback ───────────────────────────────────────────────
    // Upsert: replace existing record for same employee+date
    const idx = mem.records.findIndex(
      r => String(r.employee_id) === String(payload.employeeId) &&
           r.attendance_date === payload.attendanceDate
    );
    const record = {
      id:              idx >= 0 ? mem.records[idx].id : mem.nextId++,
      employee_id:     payload.employeeId,
      attendance_date: payload.attendanceDate,
      status:          payload.status,
      time_in:         payload.timeIn        || null,
      time_out:        payload.timeOut       || null,
      late_minutes:    payload.lateMinutes   || 0,
      hours_worked:    payload.hoursWorked   || 0,
      ot_hours:        payload.otHours       || 0,
      created_at:      new Date().toISOString()
    };
    if (idx >= 0) mem.records[idx] = record;
    else          mem.records.unshift(record);
    saveStore(mem);
    return record;
  }
}

async function setAttendanceStatus(id, status, actorUserId) {
  const result = await query(
    `UPDATE attendance
     SET status = $1, approved_by = $2, approved_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [status, actorUserId || null, id]
  );

  if (result.rowCount === 0) {
    throw notFound("Attendance record not found", "attendance_not_found");
  }

  const attendance = result.rows[0];
  await recordAuditLog({
    actorUserId,
    action: `attendance_${status}`,
    entityType: "attendance",
    entityId: String(attendance.id)
  });

  return attendance;
}

async function listTimeEntries(filters) {
  const conditions = [];
  const values = [];

  if (filters.employeeId) {
    values.push(filters.employeeId);
    conditions.push(`time_entries.employee_id = $${values.length}`);
  }

  if (filters.startDate) {
    values.push(filters.startDate);
    conditions.push(`time_entries.clock_in >= $${values.length}`);
  }

  if (filters.endDate) {
    values.push(filters.endDate);
    conditions.push(`time_entries.clock_in <= $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  values.push(filters.limit);
  const limitIndex = values.length;
  values.push(filters.offset);
  const offsetIndex = values.length;

  const result = await query(
    `SELECT time_entries.*
     FROM time_entries
     ${whereClause}
     ORDER BY time_entries.clock_in DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    values
  );

  return result.rows;
}

async function createTimeEntry(payload, actorUserId) {
  requireField(payload.employeeId, "employeeId");
  requireField(payload.clockIn, "clockIn");

  let hoursWorked = parseNumber(payload.hoursWorked, "hoursWorked");
  if (hoursWorked === null && payload.clockOut) {
    const clockIn = new Date(payload.clockIn);
    const clockOut = new Date(payload.clockOut);
    const diffMs = clockOut.getTime() - clockIn.getTime();
    if (Number.isFinite(diffMs) && diffMs >= 0) {
      hoursWorked = Math.round((diffMs / 36e5) * 100) / 100;
    }
  }

  if (hoursWorked === null) {
    throw badRequest("hoursWorked or clockOut is required", "missing_hours");
  }

  const result = await query(
    `INSERT INTO time_entries (employee_id, clock_in, clock_out, hours_worked)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [payload.employeeId, payload.clockIn, payload.clockOut || null, hoursWorked]
  );

  const entry = result.rows[0];
  await recordAuditLog({
    actorUserId,
    action: "time_entry_created",
    entityType: "time_entry",
    entityId: String(entry.id)
  });

  return entry;
}

module.exports = {
  listAttendance,
  createAttendance,
  setAttendanceStatus,
  listTimeEntries,
  createTimeEntry
};
