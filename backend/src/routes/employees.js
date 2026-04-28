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
    const b = req.body || {};
    // Accept both snake_case (from frontend) and camelCase (from API clients)
    const payload = {
      firstName:           b.firstName           || b.first_name,
      lastName:            b.lastName            || b.last_name,
      email:               b.email,
      hireDate:            b.hireDate            || b.hire_date,
      status:              b.status,
      departmentId:        b.departmentId        || b.department_id,
      departmentName:      b.departmentName      || b.department_name,
      jobTitle:            b.jobTitle            || b.job_title,
      baseSalary:          b.baseSalary          || b.base_salary,
      userId:              b.userId              || b.user_id,
      hourlyRate:          b.hourlyRate          || b.hourly_rate    || (b.base_salary ? Number(b.base_salary) / 160 : undefined),
      overtimeMultiplier:  b.overtimeMultiplier  || b.overtime_multiplier,
    };
    const employee = await createEmployee(payload, req.user && req.user.sub);
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
