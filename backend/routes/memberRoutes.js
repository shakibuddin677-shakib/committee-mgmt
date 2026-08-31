const express = require("express");
const router = express.Router({ mergeParams: true }); // inherits :committeeId from parent router
const {
  getMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
  changeMyPin,
  updateMyProfile,
} = require("../controllers/memberController");
const { requireRole } = require("../middleware/auth");
const { committeeAdminOnly, committeeMemberOnly } = require("../middleware/committeeAccess");

// req.committee is already loaded by the parent committeeRoutes router.
router.get("/", committeeAdminOnly, getMembers);
router.post("/", committeeAdminOnly, createMember);
router.put("/me/pin", committeeMemberOnly, changeMyPin); // must come before "/:id" below
router.put("/me/profile", committeeMemberOnly, updateMyProfile); // must come before "/:id" below
router.get("/:id", getMemberById); // admin or self, checked inside controller
router.put("/:id", committeeAdminOnly, updateMember);
router.delete("/:id", committeeAdminOnly, deleteMember);

module.exports = router;
