const express = require("express");
const authRoutes = require("./auth");
const createPlaceholderRouter = require("./placeholders");
const employeesRoutes = require("./employees");
const staffRoutes = require("./staff");
const attendanceRoutes = require("./attendance");
const payrollRoutes = require("./payroll");
const taxRoutes = require("./tax");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  });
});

router.get("/ready", (req, res) => {
  res.json({
    status: "ready",
    timestamp: new Date().toISOString()
  });
});

router.use("/auth", authRoutes);
router.use("/employees", authenticate, employeesRoutes);
router.use("/attendance", authenticate, attendanceRoutes);
router.use("/payroll", authenticate, payrollRoutes);
router.use("/tax", authenticate, taxRoutes);
router.use("/staff", authenticate, staffRoutes);
router.use("/analytics", createPlaceholderRouter("analytics"));
router.use("/dashboard", createPlaceholderRouter("dashboard"));

module.exports = router;
