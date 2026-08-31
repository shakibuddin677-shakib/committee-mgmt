const express = require("express");
const router = express.Router();
const {
  createCommittee,
  getMyCommittees,
  getCommitteeById,
  lookupByCode,
  updateCommittee,
  deleteCommittee,
  exportCommittee,
} = require("../controllers/committeeController");
const { requestPinReset } = require("../controllers/pinResetController");
const { createInvite, listInvites, revokeInvite, redeemInvite, removeCoAdmin } = require("../controllers/coAdminController");
const { protect, requireRole } = require("../middleware/auth");
const { loadCommittee, committeeAdminOnly, committeeAdminOrMember, committeeOwnerOnly } = require("../middleware/committeeAccess");
const { pinResetRequestLimiter } = require("../middleware/rateLimiter");

const memberRoutes = require("./memberRoutes");
const paymentRoutes = require("./paymentRoutes");
const loanRoutes = require("./loanRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const pinResetRoutes = require("./pinResetRoutes");

// Public — lets a member-login screen confirm a code before asking for phone/pin
router.get("/lookup/:code", lookupByCode);

// Public — a member who forgot their PIN has no token to authenticate with,
// so this one write has to happen before the `protect` middleware below.
// It can only ever create a "pending" request, never change a PIN itself.
router.post("/:committeeId/pin-reset-request", loadCommittee, pinResetRequestLimiter, requestPinReset);

router.use(protect);

router.post("/", requireRole("admin"), createCommittee);
router.get("/", requireRole("admin"), getMyCommittees);

// Redeeming an invite only needs the caller to be *some* logged-in admin —
// it doesn't belong to a committee they already have access to, so it
// can't live under the /:committeeId/... family below. Registered before
// "/:committeeId" so "invites" is never mistaken for a committee id.
router.post("/invites/redeem", requireRole("admin"), redeemInvite);

router.get("/:committeeId", loadCommittee, committeeAdminOrMember, getCommitteeById);
router.put("/:committeeId", loadCommittee, committeeAdminOnly, updateCommittee);
router.delete("/:committeeId", loadCommittee, committeeOwnerOnly, deleteCommittee);
router.get("/:committeeId/export", loadCommittee, committeeAdminOnly, exportCommittee);

// Co-admin invites — owner only (a co-admin shouldn't be able to invite
// further co-admins or remove one without the owner's say-so).
router.post("/:committeeId/invites", loadCommittee, committeeOwnerOnly, createInvite);
router.get("/:committeeId/invites", loadCommittee, committeeOwnerOnly, listInvites);
router.delete("/:committeeId/invites/:inviteId", loadCommittee, committeeOwnerOnly, revokeInvite);
router.delete("/:committeeId/co-admins/:adminId", loadCommittee, committeeOwnerOnly, removeCoAdmin);

// Every nested resource lives under /api/committees/:committeeId/...
// loadCommittee runs once here and attaches req.committee for all of them.
router.use("/:committeeId/members", loadCommittee, memberRoutes);
router.use("/:committeeId/payments", loadCommittee, paymentRoutes);
router.use("/:committeeId/loans", loadCommittee, loanRoutes);
router.use("/:committeeId/dashboard", loadCommittee, dashboardRoutes);
router.use("/:committeeId/pin-reset-requests", loadCommittee, pinResetRoutes);

module.exports = router;
