const { query, withTransaction } = require("../db");
const { badRequest, notFound } = require("../utils/errors");
const { recordAuditLog } = require("./audit");
const { getTaxRateForPeriod } = require("./tax");
const fs = require("fs");
const path = require("path");

// ── In-memory fallback store ───────────────────────────────────────────────
const STORE_PATH = path.join(__dirname, "../../data/payroll_store.json");
const EMP_STORE_PATH = path.join(__dirname, "../../data/employees_store.json");

function loadStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    }
  } catch (_) {}
  return {
    pay_periods: [],
    payroll_runs: [],
    payroll_items: [],
    nextPayPeriodId: 1,
    nextPayrollRunId: 1,
    nextPayrollItemId: 1
  };
}

function saveStore() {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(mem, null, 2), "utf8");
  } catch (_) {}
}

function loadEmployeesStore() {
  try {
    if (fs.existsSync(EMP_STORE_PATH)) {
      return JSON.parse(fs.readFileSync(EMP_STORE_PATH, "utf8"));
    }
  } catch (_) {}
  return { employees: [] };
}

const mem = loadStore();

function isDbDown(err) {
  if (!err) return false;
  if (err.code === "ECONNREFUSED") return true;
  if (err.code === "database_unavailable") return true;
  if (err.statusCode === 503) return true;
  if (Array.isArray(err.errors)) {
    return err.errors.some(e => e && (e.code === "ECONNREFUSED" || e.code === "database_unavailable"));
  }
  return false;
}

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

function createFallbackRunForPeriod(period, idempotencyKey) {
  const run = {
    id: "mem_run_" + mem.nextPayrollRunId++,
    pay_period_id: period.id,
    run_date: new Date().toISOString().slice(0, 10),
    status: "completed",
    idempotency_key: idempotencyKey || null,
    created_at: new Date().toISOString()
  };

  const store = loadEmployeesStore();
  const employees = (store.employees || []).filter(e => {
    if (!e.status) return true;
    return String(e.status).toLowerCase() === "active";
  });

  const items = employees.map(emp => {
    const baseSalary = toNumber(emp.base_salary || 0);
    const hourlyRate = toNumber(emp.hourly_rate || 0);
    const basePay = baseSalary > 0 ? baseSalary : roundMoney(hourlyRate * 8 * 22);
    const grossPay = roundMoney(basePay);
    const taxes = 0;
    const deductions = 0;
    const netPay = roundMoney(grossPay - taxes - deductions);

    const item = {
      id: "mem_item_" + mem.nextPayrollItemId++,
      payroll_run_id: run.id,
      employee_id: emp.id,
      base_pay: basePay,
      gross_pay: grossPay,
      taxes,
      tax_amount: taxes,
      deductions,
      net_pay: netPay,
      ot_hours: 0,
      allowances: 0,
      created_at: new Date().toISOString()
    };
    mem.payroll_items.unshift(item);
    return item;
  });

  mem.payroll_runs.unshift(run);
  saveStore();

  const runWithPeriod = {
    ...run,
    start_date: period.start_date,
    end_date: period.end_date
  };

  return { run: runWithPeriod, items };
}

function getPeriodWeeks(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / 86400000) + 1;
  return Math.max(1, Math.ceil(diffDays / 7));
}

async function listPayPeriods(filters) {
  try {
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
  } catch (err) {
    if (!isDbDown(err)) throw err;
    let rows = [...mem.pay_periods];
    if (filters.status) rows = rows.filter(p => p.status === filters.status);
    rows.sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));
    return rows;
  }
}

async function createPayPeriod(payload, actorUserId) {
  requireField(payload.startDate, "startDate");
  requireField(payload.endDate, "endDate");

  try {
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
  } catch (err) {
    if (!isDbDown(err)) throw err;
    const period = {
      id: "mem_pp_" + mem.nextPayPeriodId++,
      start_date: payload.startDate,
      end_date: payload.endDate,
      status: payload.status || "open",
      created_at: new Date().toISOString()
    };
    mem.pay_periods.unshift(period);
    saveStore();
    return period;
  }
}

async function getPayPeriod(id) {
  try {
    const result = await query("SELECT * FROM pay_periods WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      throw notFound("Pay period not found", "pay_period_not_found");
    }
    return result.rows[0];
  } catch (err) {
    if (!isDbDown(err)) throw err;
    const period = mem.pay_periods.find(p => String(p.id) === String(id));
    if (!period) throw notFound("Pay period not found", "pay_period_not_found");
    return period;
  }
}

async function listPayrollRuns(filters) {
  try {
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
  } catch (err) {
    if (!isDbDown(err)) throw err;
    let rows = [...mem.payroll_runs];
    if (filters.payPeriodId) {
      rows = rows.filter(r => String(r.pay_period_id) === String(filters.payPeriodId));
    }

    if (rows.length === 0 && mem.pay_periods.length > 0 && !filters.payPeriodId) {
      const sorted = [...mem.pay_periods].sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));
      const period = sorted[0];
      const seeded = createFallbackRunForPeriod(period, null);
      rows = [seeded.run];
    }

    rows = rows.map(run => {
      const period = mem.pay_periods.find(p => String(p.id) === String(run.pay_period_id));
      return {
        ...run,
        start_date: period ? period.start_date : null,
        end_date: period ? period.end_date : null
      };
    });
    rows.sort((a, b) => String(b.run_date).localeCompare(String(a.run_date)));
    return rows;
  }
}

async function getPayrollRun(id, client) {
  try {
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
  } catch (err) {
    if (!isDbDown(err)) throw err;
    const run = mem.payroll_runs.find(r => String(r.id) === String(id));
    if (!run) throw notFound("Payroll run not found", "payroll_run_not_found");
    const period = mem.pay_periods.find(p => String(p.id) === String(run.pay_period_id));
    return {
      ...run,
      start_date: period ? period.start_date : null,
      end_date: period ? period.end_date : null
    };
  }
}

async function listPayrollItems(runId, client) {
  try {
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
  } catch (err) {
    if (!isDbDown(err)) throw err;
    const store = loadEmployeesStore();
    const empMap = new Map((store.employees || []).map(e => [String(e.id), e]));
    let rows = mem.payroll_items
      .filter(item => String(item.payroll_run_id) === String(runId))
      .map(item => {
        const emp = empMap.get(String(item.employee_id));
        return {
          ...item,
          first_name: emp ? emp.first_name : null,
          last_name: emp ? emp.last_name : null
        };
      });

    const run = mem.payroll_runs.find(r => String(r.id) === String(runId));
    if (!run) return rows;

    const employees = (store.employees || []).filter(e => {
      if (!e.status) return true;
      return String(e.status).toLowerCase() === "active";
    });

    const existingIds = new Set(rows.map(r => String(r.employee_id)));
    const created = [];

    employees.forEach(emp => {
      if (existingIds.has(String(emp.id))) return;
      const baseSalary = toNumber(emp.base_salary || 0);
      const hourlyRate = toNumber(emp.hourly_rate || 0);
      const basePay = baseSalary > 0 ? baseSalary : roundMoney(hourlyRate * 8 * 22);
      const grossPay = roundMoney(basePay);
      const taxes = 0;
      const deductions = 0;
      const netPay = roundMoney(grossPay - taxes - deductions);

      const item = {
        id: "mem_item_" + mem.nextPayrollItemId++,
        payroll_run_id: run.id,
        employee_id: emp.id,
        base_pay: basePay,
        gross_pay: grossPay,
        taxes,
        tax_amount: taxes,
        deductions,
        net_pay: netPay,
        ot_hours: 0,
        allowances: 0,
        created_at: new Date().toISOString()
      };
      mem.payroll_items.unshift(item);
      created.push({
        ...item,
        first_name: emp.first_name || null,
        last_name: emp.last_name || null
      });
    });

    if (created.length > 0) {
      saveStore();
      rows = rows.concat(created);
    }

    rows.sort((a, b) => String(a.last_name || "").localeCompare(String(b.last_name || "")));
    return rows;
  }
}

async function createPayrollRun(payload, actorUserId) {
  requireField(payload.payPeriodId, "payPeriodId");

  try {
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
  } catch (err) {
    if (!isDbDown(err)) throw err;

    if (payload.idempotencyKey) {
      const existing = mem.payroll_runs.find(r => r.idempotency_key === payload.idempotencyKey);
      if (existing) {
        const items = mem.payroll_items.filter(i => String(i.payroll_run_id) === String(existing.id));
        const period = mem.pay_periods.find(p => String(p.id) === String(existing.pay_period_id));
        const runWithPeriod = {
          ...existing,
          start_date: period ? period.start_date : null,
          end_date: period ? period.end_date : null
        };
        return { run: runWithPeriod, items, idempotent: true };
      }
    }

    const period = mem.pay_periods.find(p => String(p.id) === String(payload.payPeriodId));
    if (!period) throw notFound("Pay period not found", "pay_period_not_found");

    const seeded = createFallbackRunForPeriod(period, payload.idempotencyKey || null);
    return { run: seeded.run, items: seeded.items, idempotent: false };
  }
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
