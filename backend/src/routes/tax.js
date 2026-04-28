const express = require("express");
const { listTaxes, createTax } = require("../services/tax");

const router = express.Router();

router.get("/rates", async (req, res, next) => {
  try {
    const taxes = await listTaxes({
      effectiveFrom: req.query.effectiveFrom,
      effectiveTo: req.query.effectiveTo
    });
    res.json({ data: taxes });
  } catch (error) {
    next(error);
  }
});

router.post("/rates", async (req, res, next) => {
  try {
    const tax = await createTax(req.body || {});
    res.status(201).json({ data: tax });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
