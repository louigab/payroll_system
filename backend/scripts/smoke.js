process.env.JWT_SECRET = process.env.JWT_SECRET || "smoke-test-secret";

const app = require("../src/app");
const { logger } = require("../src/logger");

const server = app.listen(0, () => {
  const address = server.address();
  logger.info({ port: address.port }, "Smoke test passed");
  server.close(() => process.exit(0));
});
