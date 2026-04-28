const path = require("path");
const { spawnSync } = require("child_process");
const dotenv = require("dotenv");

dotenv.config();

const command = process.argv[2];
const extraArgs = process.argv.slice(3);
const migrationDir = path.join(__dirname, "..", "db", "migrations");

function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required to run migrations.");
    process.exit(1);
  }
}

function run(commandName, args) {
  const baseArgs = ["node-pg-migrate", commandName, "-m", migrationDir];
  const result = spawnSync(
    "npx",
    baseArgs.concat(args || []),
    {
      stdio: "inherit",
      env: process.env,
      shell: true
    }
  );

  return typeof result.status === "number" ? result.status : 1;
}

if (!command) {
  console.error("Usage: npm run migrate:up|down|redo|status|create -- [args]");
  process.exit(1);
}

if (["up", "down", "status", "redo"].includes(command)) {
  requireDatabaseUrl();
}

if (command === "redo") {
  const downStatus = run("down", ["-c", "1"]);
  if (downStatus !== 0) {
    process.exit(downStatus);
  }
  process.exit(run("up", ["-c", "1"]));
}

if (command === "create" && extraArgs.length === 0) {
  console.error("Usage: npm run migrate:create -- <name>");
  process.exit(1);
}

process.exit(run(command, extraArgs));
