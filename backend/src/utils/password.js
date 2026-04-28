const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 10;

function hashPassword(value) {
  return bcrypt.hash(value, SALT_ROUNDS);
}

function comparePassword(value, hash) {
  return bcrypt.compare(value, hash);
}

module.exports = {
  hashPassword,
  comparePassword,
  SALT_ROUNDS
};
