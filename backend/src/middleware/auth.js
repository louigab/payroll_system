const { unauthorized, forbidden } = require("../utils/errors");
const { verifyToken } = require("../utils/jwt");

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const parts = header.split(" ");
  const scheme = parts[0];
  const token = parts[1];

  if (scheme !== "Bearer" || !token) {
    return next(unauthorized("Missing or invalid Authorization header"));
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    return next();
  } catch (error) {
    return next(unauthorized("Invalid or expired token"));
  }
}

function requireRoles(roles) {
  return (req, res, next) => {
    const userRoles = (req.user && req.user.roles) || [];
    const allowed = roles.some((role) => userRoles.includes(role));

    if (!allowed) {
      return next(forbidden("Insufficient role"));
    }

    return next();
  };
}

module.exports = {
  authenticate,
  requireRoles
};
