const express = require("express");
const { comparePassword } = require("../utils/password");
const { signToken, expiresInSeconds } = require("../utils/jwt");
const { findUserByEmail, toPublicUser } = require("../data/users");
const { badRequest, unauthorized } = require("../utils/errors");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.post("/login", async (req, res, next) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return next(badRequest("Email and password are required", "missing_credentials"));
  }

  const user = findUserByEmail(email);
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

module.exports = router;
