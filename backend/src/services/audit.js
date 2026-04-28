const { query } = require("../db");

async function recordAuditLog(payload, client) {
  const runner = client ? client : { query };
  const metadata = payload.metadata ? JSON.stringify(payload.metadata) : null;

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
}

module.exports = {
  recordAuditLog
};
