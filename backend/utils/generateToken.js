const jwt = require("jsonwebtoken");

// payload: { id, role, committee? }
// committee is only relevant for role "member" — it's the committee they
// belong to, and lets committee-scoped middleware check access without an
// extra database lookup on every request.
function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

module.exports = generateToken;
