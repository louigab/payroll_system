const express = require("express");
const { comparePassword } = require("../utils/password");
const { signToken, expiresInSeconds } = require("../utils/jwt");
const { findUserByEmail, findUserById, createUser, updateUserPassword, toPublicUser } = require("../data/users");
const { badRequest, unauthorized } = require("../utils/errors");
const { authenticate } = require("../middleware/auth");
const { listEmployees } = require("../services/employees");

const STAFF_DEFAULT_PASSWORD = "password123";

const router = express.Router();

router.post("/login", async (req, res, next) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return next(badRequest("Email and password are required", "missing_credentials"));
  }

  let user = findUserByEmail(email);

  // If no user found, check if this email belongs to an employee —
  // auto-provision their account so logins survive server restarts.
  if (!user) {
    try {
      const employees = await listEmployees({ limit: 200, offset: 0 });
      const match = employees.find(
        (e) => e.email && e.email.toLowerCase().trim() === email.toLowerCase().trim()
      );
      if (match) {
        const { user: newUser } = createUser(email, STAFF_DEFAULT_PASSWORD, ["staff"]);
        user = newUser;
      }
    } catch (_) { /* fallback: just leave user as null */ }
  }

  if (!user) {
    return next(unauthorized("Invalid credentials"));
  }

  const matches = await comparePassword(password, user.passwordHash);
  if (!matches) {
    return next(unauthorized("Invalid credentials"));
  }

  const token = signToken({
    sub: user.id,
    email: user.email,
    roles: user.roles
  });

  res.json({
    data: {
      accessToken: token,
      tokenType: "Bearer",
      expiresIn: expiresInSeconds,
      user: toPublicUser(user)
    }
  });
});

router.post("/logout", (req, res) => {
  res.status(204).send();
});

router.get("/me", authenticate, (req, res) => {
  res.json({
    data: {
      user: req.user
    }
  });
});

router.post("/change-password", authenticate, async (req, res, next) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return next(badRequest("currentPassword and newPassword are required", "missing_fields"));
  }
  if (newPassword.length < 6) {
    return next(badRequest("New password must be at least 6 characters", "password_too_short"));
  }
  const user = findUserById(req.user.sub);
  if (!user) return next(unauthorized("User not found"));
  const matches = await comparePassword(currentPassword, user.passwordHash);
  if (!matches) return next(unauthorized("Current password is incorrect"));
  updateUserPassword(user.email, newPassword);
  res.json({ data: { message: "Password updated successfully" } });
});

module.exports = router;
