const jwt = require("jsonwebtoken");

// Verifies the JWT sent in the Authorization header (Bearer <token>)
function protect(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Not authorized. No token provided." });
  }
  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Not authorized. Token invalid or expired." });
  }
}

// Restricts a route to one or more roles, e.g. requireRole("admin")
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Forbidden. You don't have access to this resource." });
    }
    next();
  };
}

module.exports = { protect, requireRole };
