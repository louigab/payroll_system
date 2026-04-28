const http = require("http");

const app = require("./app");
const { port } = require("./config");
const { logger } = require("./logger");

const server = http.createServer(app);

server.listen(port, () => {
  logger.info({ port }, "Payroll API listening");
});

function shutdown(signal) {
  logger.info({ signal }, "Shutting down");
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
