const bcrypt = require("bcryptjs");

let _nextId = 2;

const users = [
  {
    id: "u_1",
    email: "admin@payroll.test",
    passwordHash: bcrypt.hashSync("password123", 10),
    roles: ["admin", "payroll"]
  }
];

function findUserByEmail(email) {
  return users.find((u) => u.email === (email || "").toLowerCase().trim());
}

function findUserById(id) {
  return users.find((u) => u.id === id);
}

/**
 * Create a new staff user. Returns { user, created } where created=false if email already exists.
 */
function createUser(email, plainPassword, roles) {
  const normalized = (email || "").toLowerCase().trim();
  const existing = findUserByEmail(normalized);
  if (existing) return { user: existing, created: false };
  const newUser = {
    id: `u_${_nextId++}`,
    email: normalized,
    passwordHash: bcrypt.hashSync(plainPassword, 10),
    roles: roles || ["staff"]
  };
  users.push(newUser);
  return { user: newUser, created: true };
}

function updateUserPassword(email, newPlainPassword) {
  const user = findUserByEmail(email);
  if (!user) return false;
  user.passwordHash = bcrypt.hashSync(newPlainPassword, 10);
  return true;
}

function toPublicUser(user) {
  if (!user) {
    return null;
  }
  const { passwordHash, ...rest } = user;
  return rest;
}

module.exports = {
  users,
  findUserByEmail,
  findUserById,
  createUser,
  updateUserPassword,
  toPublicUser
};
