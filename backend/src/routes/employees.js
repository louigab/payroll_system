const express = require("express");
const {
  listEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee
} = require("../services/employees");
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
    const employees = await listEmployees({
      search: req.query.search,
      departmentId: req.query.departmentId,
      status: req.query.status,
      limit: paging.limit,
      offset: paging.offset
    });
    res.json({ data: employees });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const employee = await getEmployeeById(req.params.id);
    res.json({ data: employee });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const employee = await createEmployee(req.body || {}, req.user && req.user.sub);
    res.status(201).json({ data: employee });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const employee = await updateEmployee(req.params.id, req.body || {}, req.user && req.user.sub);
    res.json({ data: employee });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await deleteEmployee(req.params.id, req.user && req.user.sub);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
