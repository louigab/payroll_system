const express = require("express");
const {
  listAttendance,
  createAttendance,
  setAttendanceStatus,
  listTimeEntries,
  createTimeEntry
} = require("../services/attendance");
const { badRequest } = require("../utils/errors");

const router = express.Router();

function parsePaging(query) {
  const limit = query.limit ? Number(query.limit) : 50;
  const offset = query.offset ? Number(query.offset) : 0;

  if (!Number.isFinite(limit) || limit <= 0 || limit > 200) {
    throw badRequest("Invalid limit", "invalid_limit");
  }
  if (!Number.isFinite(offset) || offset < 0) {
    throw badRequest("Invalid offset", "invalid_offset");
  }

  return { limit, offset };
}

router.get("/", async (req, res, next) => {
  try {
    const paging = parsePaging(req.query);
    const records = await listAttendance({
      employeeId: req.query.employeeId,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: paging.limit,
      offset: paging.offset
    });
    res.json({ data: records });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const attendance = await createAttendance(req.body || {}, req.user && req.user.sub);
    res.status(201).json({ data: attendance });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/approve", async (req, res, next) => {
  try {
    const attendance = await setAttendanceStatus(
      req.params.id,
      "approved",
      req.user && req.user.sub
    );
    res.json({ data: attendance });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/reject", async (req, res, next) => {
  try {
    const attendance = await setAttendanceStatus(
      req.params.id,
      "rejected",
      req.user && req.user.sub
    );
    res.json({ data: attendance });
  } catch (error) {
    next(error);
  }
});

router.get("/time-entries", async (req, res, next) => {
  try {
    const paging = parsePaging(req.query);
    const entries = await listTimeEntries({
      employeeId: req.query.employeeId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: paging.limit,
      offset: paging.offset
    });
    res.json({ data: entries });
  } catch (error) {
    next(error);
  }
});

router.post("/time-entries", async (req, res, next) => {
  try {
    const entry = await createTimeEntry(req.body || {}, req.user && req.user.sub);
    res.status(201).json({ data: entry });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
