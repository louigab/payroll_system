const { query, withTransaction } = require("../db");
const { badRequest, notFound } = require("../utils/errors");
const { recordAuditLog } = require("./audit");
const { getTaxRateForPeriod } = require("./tax");

function requireField(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw badRequest(`${fieldName} is required`, "missing_field");
  }
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function getPeriodWeeks(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / 86400000) + 1;
  return Math.max(1, Math.ceil(diffDays / 7));
}

async function listPayPeriods(filters) {
  const conditions = [];
  const values = [];

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`status = $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await query(
    `SELECT * FROM pay_periods ${whereClause} ORDER BY start_date DESC`,
    values
  );

  return result.rows;
}

async function createPayPeriod(payload, actorUserId) {
  requireField(payload.startDate, "startDate");
  requireField(payload.endDate, "endDate");

  const result = await query(
    `INSERT INTO pay_periods (start_date, end_date, status)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [payload.startDate, payload.endDate, payload.status || "open"]
  );

  const period = result.rows[0];
  await recordAuditLog({
    actorUserId,
    action: "pay_period_created",
    entityType: "pay_period",
    entityId: String(period.id)
  });

  return period;
}

async function getPayPeriod(id) {
  const result = await query("SELECT * FROM pay_periods WHERE id = $1", [id]);
  if (result.rowCount === 0) {
    throw notFound("Pay period not found", "pay_period_not_found");
  }
  return result.rows[0];
}

async function listPayrollRuns(filters) {
  const conditions = [];
  const values = [];

  if (filters.payPeriodId) {
    values.push(filters.payPeriodId);
    conditions.push(`payroll_runs.pay_period_id = $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await query(
    `SELECT payroll_runs.*, pay_periods.start_date, pay_periods.end_date
     FROM payroll_runs
     JOIN pay_periods ON payroll_runs.pay_period_id = pay_periods.id
     ${whereClause}
     ORDER BY payroll_runs.run_date DESC`,
    values
  );

  return result.rows;
}

async function getPayrollRun(id, client) {
  const runner = client ? client : { query };
  const result = await runner.query(
    `SELECT payroll_runs.*, pay_periods.start_date, pay_periods.end_date
     FROM payroll_runs
     JOIN pay_periods ON payroll_runs.pay_period_id = pay_periods.id
     WHERE payroll_runs.id = $1`,
    [id]
  );

  if (result.rowCount === 0) {
    throw notFound("Payroll run not found", "payroll_run_not_found");
  }

  return result.rows[0];
}

async function listPayrollItems(runId, client) {
  const runner = client ? client : { query };
  const result = await runner.query(
    `SELECT payroll_items.*, employees.first_name, employees.last_name
     FROM payroll_items
     JOIN employees ON payroll_items.employee_id = employees.id
     WHERE payroll_items.payroll_run_id = $1
     ORDER BY employees.last_name ASC, employees.first_name ASC`,
    [runId]
  );

  return result.rows;
}

async function createPayrollRun(payload, actorUserId) {
  requireField(payload.payPeriodId, "payPeriodId");

  return withTransaction(async (client) => {
    if (payload.idempotencyKey) {
      const existing = await client.query(
        "SELECT id FROM payroll_runs WHERE idempotency_key = $1",
        [payload.idempotencyKey]
      );

      if (existing.rowCount > 0) {
        const run = await getPayrollRun(existing.rows[0].id, client);
        const items = await listPayrollItems(existing.rows[0].id, client);
        return { run, items, idempotent: true };
      }
    }

    const periodResult = await client.query(
      "SELECT * FROM pay_periods WHERE id = $1",
      [payload.payPeriodId]
    );

    if (periodResult.rowCount === 0) {
      throw notFound("Pay period not found", "pay_period_not_found");
    }

    const period = periodResult.rows[0];
    const runDate = payload.runDate || new Date().toISOString().slice(0, 10);

    const runResult = await client.query(
      `INSERT INTO payroll_runs (pay_period_id, run_date, status, idempotency_key)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [payload.payPeriodId, runDate, "processing", payload.idempotencyKey || null]
    );

    const run = runResult.rows[0];
    const weeks = getPeriodWeeks(period.start_date, period.end_date);
    const startDate = new Date(period.start_date);
    const endDate = new Date(period.end_date);
    const endExclusive = new Date(endDate);
    endExclusive.setDate(endExclusive.getDate() + 1);

    const employeesResult = await client.query(
      "SELECT id, hourly_rate, overtime_multiplier FROM employees WHERE status = 'active'"
    );

    const deductionsResult = await client.query(
      "SELECT COALESCE(SUM(default_amount), 0) AS total FROM deductions"
    );
    const benefitsResult = await client.query(
      "SELECT COALESCE(SUM(default_amount), 0) AS total FROM benefits"
    );

    const deductionsTotal = toNumber(deductionsResult.rows[0].total);
    const benefitsTotal = toNumber(benefitsResult.rows[0].total);
    const taxRate = await getTaxRateForPeriod(period.start_date, period.end_date, client);

    const items = [];

    for (const employee of employeesResult.rows) {
      const hoursResult = await client.query(
        `SELECT COALESCE(SUM(hours_worked), 0) AS total_hours
         FROM time_entries
         WHERE employee_id = $1 AND clock_in >= $2 AND clock_in < $3`,
        [employee.id, startDate, endExclusive]
      );

      const hours = toNumber(hoursResult.rows[0].total_hours);
      const overtimeThreshold = 40 * weeks;
      const overtimeHours = Math.max(0, hours - overtimeThreshold);
      const baseHours = Math.max(0, hours - overtimeHours);
      const hourlyRate = toNumber(employee.hourly_rate);
      const overtimeMultiplier = toNumber(employee.overtime_multiplier) || 1.5;

      const basePay = roundMoney(baseHours * hourlyRate);
      const overtimePay = roundMoney(overtimeHours * hourlyRate * overtimeMultiplier);
      const grossPay = roundMoney(basePay + overtimePay);
      const totalDeductions = roundMoney(deductionsTotal + benefitsTotal);
      const taxablePay = Math.max(0, grossPay - totalDeductions);
      const taxes = roundMoney(taxablePay * taxRate);
      const netPay = roundMoney(grossPay - totalDeductions - taxes);

      const itemResult = await client.query(
        `INSERT INTO payroll_items
         (payroll_run_id, employee_id, gross_pay, taxes, deductions, net_pay)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [run.id, employee.id, grossPay, taxes, totalDeductions, netPay]
      );

      items.push(itemResult.rows[0]);
    }

    await client.query("UPDATE payroll_runs SET status = $1 WHERE id = $2", [
      "completed",
      run.id
    ]);

    await recordAuditLog(
      {
        actorUserId,
        action: "payroll_run_completed",
        entityType: "payroll_run",
        entityId: String(run.id),
        metadata: { payPeriodId: period.id }
      },
      client
    );

    const finalRun = await getPayrollRun(run.id, client);
    return { run: finalRun, items, idempotent: false };
  });
}

module.exports = {
  listPayPeriods,
  createPayPeriod,
  getPayPeriod,
  listPayrollRuns,
  getPayrollRun,
  listPayrollItems,
  createPayrollRun
};
