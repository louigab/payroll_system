const pino = require("pino");
const { env } = require("./config");

const logger = pino({
  level: env === "production" ? "info" : "debug",
  base: { service: "payroll-api" }
});

module.exports = { logger };
