const { query } = require("../db");
const { badRequest } = require("../utils/errors");

function requireField(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw badRequest(`${fieldName} is required`, "missing_field");
  }
}

async function listTaxes(filters) {
  const conditions = [];
  const values = [];

  if (filters.effectiveFrom) {
    values.push(filters.effectiveFrom);
    conditions.push(`effective_from >= $${values.length}`);
  }

  if (filters.effectiveTo) {
    values.push(filters.effectiveTo);
    conditions.push(`effective_to <= $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await query(
    `SELECT * FROM taxes ${whereClause} ORDER BY effective_from DESC, name ASC`,
    values
  );

  return result.rows;
}

async function createTax(payload) {
  requireField(payload.name, "name");
  requireField(payload.rate, "rate");
  requireField(payload.effectiveFrom, "effectiveFrom");

  const rate = Number(payload.rate);
  if (!Number.isFinite(rate)) {
    throw badRequest("Invalid rate", "invalid_rate");
  }

  const result = await query(
    `INSERT INTO taxes (name, rate, effective_from, effective_to)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [payload.name, rate, payload.effectiveFrom, payload.effectiveTo || null]
  );

  return result.rows[0];
}

async function getTaxRateForPeriod(startDate, endDate, client) {
  const runner = client ? client : { query };
  const result = await runner.query(
    `SELECT COALESCE(SUM(rate), 0) AS total_rate
     FROM taxes
     WHERE effective_from <= $2
       AND (effective_to IS NULL OR effective_to >= $1)`,
    [startDate, endDate]
  );

  const totalRate = Number(result.rows[0].total_rate || 0);
  return Number.isFinite(totalRate) ? totalRate : 0;
}

module.exports = {
  listTaxes,
  createTax,
  getTaxRateForPeriod
};
