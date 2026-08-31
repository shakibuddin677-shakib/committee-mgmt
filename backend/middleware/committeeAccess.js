const Committee = require("../models/Committee");

// Loads the committee named in the URL (:committeeId) and attaches it to
// req.committee. Every committee-scoped route runs this first. coAdmins is
// populated with name/email so admin-facing screens (Settings) can show
// who currently co-manages this committee without a second round trip.
async function loadCommittee(req, res, next) {
  try {
    const committee = await Committee.findById(req.params.committeeId).populate("coAdmins", "name email");
    if (!committee) {
      return res.status(404).json({ success: false, message: "Committee not found." });
    }
    req.committee = committee;
    next();
  } catch (err) {
    next(err);
  }
}

function isOwnerOrCoAdmin(committee, adminId) {
  if (String(committee.owner) === String(adminId)) return true;
  return (committee.coAdmins || []).some((c) => String(c._id || c) === String(adminId));
}

// The owning admin OR a co-admin may proceed. Use for writes:
// creating/editing members, recording payments, giving loans, editing rules.
// Managing co-admins/invites themselves, and deleting the committee, are
// intentionally NOT covered by this — see committeeOwnerOnly below.
function committeeAdminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Only the committee's admin can do this." });
  }
  if (!isOwnerOrCoAdmin(req.committee, req.user.id)) {
    return res.status(403).json({ success: false, message: "You don't manage this committee." });
  }
  next();
}

// Allows either the owning admin/co-admin, or a member who belongs to this
// exact committee (checked via the committee id embedded in their token at
// login). Use for reads: dashboard summary, viewing rules, etc.
function committeeAdminOrMember(req, res, next) {
  if (req.user.role === "admin") {
    if (!isOwnerOrCoAdmin(req.committee, req.user.id)) {
      return res.status(403).json({ success: false, message: "You don't manage this committee." });
    }
    return next();
  }
  // member
  if (String(req.user.committee) !== String(req.params.committeeId)) {
    return res.status(403).json({ success: false, message: "You don't belong to this committee." });
  }
  next();
}

// Stricter than committeeAdminOnly: only the ORIGINAL owner, never a
// co-admin. Reserved for actions that change who has admin power at all
// (inviting/removing co-admins) or that destroy the whole committee — a
// co-admin shouldn't be able to lock the owner out or nuke everything.
function committeeOwnerOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Only the committee's owner can do this." });
  }
  if (String(req.committee.owner) !== String(req.user.id)) {
    return res.status(403).json({ success: false, message: "Only the committee's original owner can do this." });
  }
  next();
}

// Only a logged-in member belonging to this exact committee may proceed.
// Use for member self-service writes, like requesting a loan — an admin
// token, or a member token for a *different* committee, is rejected.
function committeeMemberOnly(req, res, next) {
  if (req.user.role !== "member") {
    return res.status(403).json({ success: false, message: "Only members can do this." });
  }
  if (String(req.user.committee) !== String(req.params.committeeId)) {
    return res.status(403).json({ success: false, message: "You don't belong to this committee." });
  }
  next();
}

module.exports = {
  loadCommittee,
  committeeAdminOnly,
  committeeAdminOrMember,
  committeeOwnerOnly,
  committeeMemberOnly,
  isOwnerOrCoAdmin,
};
