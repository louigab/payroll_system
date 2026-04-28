const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const pinoHttp = require("pino-http");
const crypto = require("crypto");

const { logger } = require("./logger");
const { apiBasePath } = require("./config");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.disable("x-powered-by");

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(
  pinoHttp({
    logger,
    genReqId: (req) =>
      req.headers["x-request-id"] ||
      (crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`)
  })
);

app.use(apiBasePath, routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
