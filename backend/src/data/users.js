const bcrypt = require("bcryptjs");

const users = [
  {
    id: "u_1",
    email: "admin@payroll.test",
    passwordHash: bcrypt.hashSync("password123", 10),
    roles: ["admin", "payroll"]
  }
];

function findUserByEmail(email) {
  return users.find((user) => user.email === email);
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
  toPublicUser
};
