const { query } = require("../db");

function isDbDown(err) {
  if (!err) return false;
  if (err.code === "ECONNREFUSED") return true;
  if (Array.isArray(err.errors)) return err.errors.some(e => e && e.code === "ECONNREFUSED");
  return false;
}

async function recordAuditLog(payload, client) {
  const runner = client ? client : { query };
  const metadata = payload.metadata ? JSON.stringify(payload.metadata) : null;

  try {
    await runner.query(
      "INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5)",
      [
        payload.actorUserId || null,
        payload.action,
        payload.entityType,
        payload.entityId || null,
        metadata
      ]
    );
  } catch (err) {
    if (!isDbDown(err)) throw err;
    // Silently skip audit logging when DB is unavailable
  }
}

module.exports = {
  recordAuditLog
};
