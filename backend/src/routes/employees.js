const express = require("express");
const {
  listEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee
} = require("../services/employees");
const { createUser } = require("../data/users");
const { badRequest } = require("../utils/errors");

const DEFAULT_STAFF_PASSWORD = "password123";

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

    // Auto-provision a staff portal account for the employee
    let tempPassword = null;
    if (payload.email) {
      const { created } = createUser(payload.email, DEFAULT_STAFF_PASSWORD, ["staff"]);
      if (created) tempPassword = DEFAULT_STAFF_PASSWORD;
    }

    res.status(201).json({ data: { ...employee, tempPassword } });
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

// Provision (or reset) a staff portal login for an existing employee
router.post("/:id/provision-login", async (req, res, next) => {
  try {
    const employee = await getEmployeeById(req.params.id);
    if (!employee || !employee.email) {
      return next(badRequest("Employee must have an email address to create a login", "no_email"));
    }
    const { createUser, findUserByEmail, updateUserPassword } = require("../data/users");
    const existing = findUserByEmail(employee.email);
    if (existing) {
      // Reset password to default
      updateUserPassword(employee.email, DEFAULT_STAFF_PASSWORD);
      return res.json({ data: { email: employee.email, tempPassword: DEFAULT_STAFF_PASSWORD, reset: true } });
    }
    createUser(employee.email, DEFAULT_STAFF_PASSWORD, ["staff"]);
    res.json({ data: { email: employee.email, tempPassword: DEFAULT_STAFF_PASSWORD, reset: false } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
