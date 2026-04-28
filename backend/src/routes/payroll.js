const express = require("express");
const {
  listPayPeriods,
  createPayPeriod,
  getPayPeriod,
  listPayrollRuns,
  getPayrollRun,
  listPayrollItems,
  createPayrollRun
} = require("../services/payroll");

const router = express.Router();

router.get("/periods", async (req, res, next) => {
  try {
    const periods = await listPayPeriods({ status: req.query.status });
    res.json({ data: periods });
  } catch (error) {
    next(error);
  }
});

router.post("/periods", async (req, res, next) => {
  try {
    const period = await createPayPeriod(req.body || {}, req.user && req.user.sub);
    res.status(201).json({ data: period });
  } catch (error) {
    next(error);
  }
});

router.get("/periods/:id", async (req, res, next) => {
  try {
    const period = await getPayPeriod(req.params.id);
    res.json({ data: period });
  } catch (error) {
    next(error);
  }
});

router.get("/runs", async (req, res, next) => {
  try {
    const runs = await listPayrollRuns({ payPeriodId: req.query.payPeriodId });
    res.json({ data: runs });
  } catch (error) {
    next(error);
  }
});

router.post("/runs", async (req, res, next) => {
  try {
    const idempotencyKey = req.header("Idempotency-Key") || req.body.idempotencyKey;
    const result = await createPayrollRun(
      {
        payPeriodId: req.body.payPeriodId,
        runDate: req.body.runDate,
        idempotencyKey
      },
      req.user && req.user.sub
    );
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.get("/runs/:id", async (req, res, next) => {
  try {
    const run = await getPayrollRun(req.params.id);
    res.json({ data: run });
  } catch (error) {
    next(error);
  }
});

router.get("/runs/:id/items", async (req, res, next) => {
  try {
    const items = await listPayrollItems(req.params.id);
    res.json({ data: items });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
