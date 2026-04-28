const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config");

const issuer = "payroll-api";
const expiresInSeconds = 60 * 60 * 8;

function signToken(payload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: expiresInSeconds, issuer });
}

function verifyToken(token) {
  return jwt.verify(token, jwtSecret, { issuer });
}

module.exports = {
  signToken,
  verifyToken,
  expiresInSeconds
};
