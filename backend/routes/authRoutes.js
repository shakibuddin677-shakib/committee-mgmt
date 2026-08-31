const express = require("express");
const router = express.Router();
const { registerAdmin, loginAdmin, loginMember, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const { memberLoginLimiter, adminLoginLimiter, registerLimiter } = require("../middleware/rateLimiter");

router.post("/admin/register", registerLimiter, registerAdmin);
router.post("/admin/login", adminLoginLimiter, loginAdmin);
router.post("/member/login", memberLoginLimiter, loginMember);
router.get("/me", protect, getMe);

module.exports = router;
