const { Pool } = require("pg");
const { databaseUnavailable } = require("../utils/errors");

let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw databaseUnavailable("DATABASE_URL is not configured");
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

async function query(text, params) {
  const activePool = getPool();
  return activePool.query(text, params);
}

async function withTransaction(callback) {
  const activePool = getPool();
  const client = await activePool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  query,
  withTransaction
};
