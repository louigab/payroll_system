const dotenv = require("dotenv");

dotenv.config();

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function toNumber(name, value, fallback) {
  const raw = value ?? fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number for ${name}`);
  }
  return parsed;
}

const config = {
  env: process.env.NODE_ENV || "development",
  port: toNumber("PORT", process.env.PORT, 4000),
  jwtSecret: requireEnv("JWT_SECRET"),
  apiBasePath: "/api/v1"
};

module.exports = config;
