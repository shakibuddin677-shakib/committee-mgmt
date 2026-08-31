const CommitteeInvite = require("../models/CommitteeInvite");
const Committee = require("../models/Committee");

const INVITE_EXPIRY_DAYS = 7;

// @route  POST /api/committees/:committeeId/invites   (owner only)
// @desc   Generates a code the owner shares out-of-band (call, WhatsApp,
//         in person) with another admin account. That admin redeems it
//         via POST /api/committees/invites/redeem to become a co-admin.
async function createInvite(req, res, next) {
  try {
    const code = await CommitteeInvite.generateUniqueCode();
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const invite = await CommitteeInvite.create({
      committee: req.committee._id,
      code,
      createdBy: req.user.id,
      expiresAt,
    });
    res.status(201).json({ success: true, invite });
  } catch (err) {
    next(err);
  }
}

// @route  GET /api/committees/:committeeId/invites   (owner only)
async function listInvites(req, res, next) {
  try {
    const invites = await CommitteeInvite.find({ committee: req.committee._id })
      .populate("usedBy", "name email")
      .sort({ createdAt: -1 });
    res.json({ success: true, invites });
  } catch (err) {
    next(err);
  }
}

// @route  DELETE /api/committees/:committeeId/invites/:inviteId   (owner only)
async function revokeInvite(req, res, next) {
  try {
    const invite = await CommitteeInvite.findOne({ _id: req.params.inviteId, committee: req.committee._id, status: "pending" });
    if (!invite) return res.status(404).json({ success: false, message: "Invite not found or already used/revoked." });
    invite.status = "revoked";
    await invite.save();
    res.json({ success: true, invite });
  } catch (err) {
    next(err);
  }
}

// @route  POST /api/committees/invites/redeem   (any logged-in admin)
// @desc   The invited admin enters the code themselves. On success they
//         become a co-admin and the committee will show up next time they
//         call GET /api/committees (their "my committees" list).
async function redeemInvite(req, res, next) {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: "code is required." });

    const invite = await CommitteeInvite.findOne({ code: code.trim().toUpperCase() });
    if (!invite || invite.status !== "pending") {
      return res.status(404).json({ success: false, message: "That invite code is invalid or has already been used." });
    }
    if (invite.expiresAt < new Date()) {
      invite.status = "revoked";
      await invite.save();
      return res.status(410).json({ success: false, message: "That invite code has expired. Ask the owner for a new one." });
    }

    const committee = await Committee.findById(invite.committee);
    if (!committee) return res.status(404).json({ success: false, message: "Committee not found." });

    if (String(committee.owner) === String(req.user.id)) {
      return res.status(409).json({ success: false, message: "You already own this committee." });
    }
    const alreadyCoAdmin = committee.coAdmins.some((c) => String(c) === String(req.user.id));
    if (alreadyCoAdmin) {
      return res.status(409).json({ success: false, message: "You're already a co-admin of this committee." });
    }

    committee.coAdmins.push(req.user.id);
    await committee.save();

    invite.status = "used";
    invite.usedBy = req.user.id;
    await invite.save();

    res.json({ success: true, committee });
  } catch (err) {
    next(err);
  }
}

// @route  DELETE /api/committees/:committeeId/co-admins/:adminId   (owner only)
async function removeCoAdmin(req, res, next) {
  try {
    req.committee.coAdmins = req.committee.coAdmins.filter((c) => String(c._id || c) !== String(req.params.adminId));
    await req.committee.save();
    res.json({ success: true, committee: req.committee });
  } catch (err) {
    next(err);
  }
}

module.exports = { createInvite, listInvites, revokeInvite, redeemInvite, removeCoAdmin };
