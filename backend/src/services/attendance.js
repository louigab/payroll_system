const { query } = require("../db");
const { badRequest, notFound } = require("../utils/errors");
const { recordAuditLog } = require("./audit");

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
}

async function createAttendance(payload, actorUserId) {
  requireField(payload.employeeId, "employeeId");
  requireField(payload.attendanceDate, "attendanceDate");
  requireField(payload.status, "status");

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
