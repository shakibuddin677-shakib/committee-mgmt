const Member = require("../models/Member");
const { isOwnerOrCoAdmin } = require("../middleware/committeeAccess");

// @route  GET /api/committees/:committeeId/members          (owning admin only)
async function getMembers(req, res, next) {
  try {
    const members = await Member.find({ committee: req.committee._id }).select("-pin").sort({ name: 1 });
    res.json({ success: true, count: members.length, members });
  } catch (err) {
    next(err);
  }
}

// @route  GET /api/committees/:committeeId/members/:id      (admin, or the member viewing themself)
async function getMemberById(req, res, next) {
  try {
    if (req.user.role === "member") {
      if (req.user.id !== req.params.id) {
        return res.status(403).json({ success: false, message: "You can only view your own profile." });
      }
    } else if (!isOwnerOrCoAdmin(req.committee, req.user.id)) {
      // Bug fix: an admin who doesn't own/co-manage THIS committee could
      // previously read any member's profile just by guessing/knowing the
      // committeeId + memberId, since only the member-self case was
      // checked here. Now every admin request is verified too.
      return res.status(403).json({ success: false, message: "You don't manage this committee." });
    }
    const member = await Member.findOne({ _id: req.params.id, committee: req.committee._id }).select("-pin");
    if (!member) return res.status(404).json({ success: false, message: "Member not found in this committee." });
    res.json({ success: true, member });
  } catch (err) {
    next(err);
  }
}

// @route  POST /api/committees/:committeeId/members         (owning admin only)
async function createMember(req, res, next) {
  try {
    const { name, phone, pin, monthlyAmount } = req.body;
    if (!name || !phone || !pin) {
      return res.status(400).json({ success: false, message: "name, phone and pin are required." });
    }
    if (String(pin).length !== 4) {
      return res.status(400).json({ success: false, message: "pin must be exactly 4 digits." });
    }
    const member = await Member.create({
      committee: req.committee._id,
      name,
      phone,
      pin,
      monthlyAmount: monthlyAmount || req.committee.monthlyDefault,
    });
    const { pin: _omit, ...safe } = member.toObject();
    res.status(201).json({ success: true, member: safe });
  } catch (err) {
    next(err);
  }
}

// @route  PUT /api/committees/:committeeId/members/:id      (owning admin only)
async function updateMember(req, res, next) {
  try {
    const { name, phone, monthlyAmount, active, pin } = req.body;
    const member = await Member.findOne({ _id: req.params.id, committee: req.committee._id });
    if (!member) return res.status(404).json({ success: false, message: "Member not found in this committee." });

    if (name !== undefined) member.name = name;
    if (phone !== undefined) member.phone = phone;
    if (monthlyAmount !== undefined) member.monthlyAmount = monthlyAmount;
    if (active !== undefined) member.active = active;
    if (pin !== undefined) member.pin = pin; // pre-save hook re-hashes it

    await member.save();
    const { pin: _omit, ...safe } = member.toObject();
    res.json({ success: true, member: safe });
  } catch (err) {
    next(err);
  }
}

// @route  DELETE /api/committees/:committeeId/members/:id   (owning admin only)
async function deleteMember(req, res, next) {
  try {
    const member = await Member.findOneAndDelete({ _id: req.params.id, committee: req.committee._id });
    if (!member) return res.status(404).json({ success: false, message: "Member not found in this committee." });
    res.json({ success: true, message: "Member removed." });
  } catch (err) {
    next(err);
  }
}

// @route  PUT /api/committees/:committeeId/members/me/pin   (member only, self)
// @desc   A logged-in member changes their own PIN. Unlike the admin's PUT
//         /:id (which can blind-overwrite a member's pin), this always
//         requires the current PIN to be proven first.
async function changeMyPin(req, res, next) {
  try {
    const { currentPin, newPin } = req.body;
    if (!currentPin || !newPin) {
      return res.status(400).json({ success: false, message: "currentPin and newPin are required." });
    }
    if (String(newPin).length !== 4) {
      return res.status(400).json({ success: false, message: "newPin must be exactly 4 digits." });
    }

    const member = await Member.findOne({ _id: req.user.id, committee: req.committee._id });
    if (!member) return res.status(404).json({ success: false, message: "Member not found." });

    const matches = await member.comparePin(currentPin);
    if (!matches) return res.status(401).json({ success: false, message: "Current PIN is incorrect." });

    member.pin = newPin; // pre-save hook re-hashes it
    await member.save();

    res.json({ success: true, message: "PIN updated." });
  } catch (err) {
    next(err);
  }
}

// @route  PUT /api/committees/:committeeId/members/me/profile   (member only, self)
// @desc   Lets a member update their own contact phone number. Deliberately
//         narrow — name, monthlyAmount and active status stay admin-only
//         (via updateMember) so a member can't quietly change what they owe.
async function updateMyProfile(req, res, next) {
  try {
    const { phone } = req.body;
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: "A valid phone number is required." });
    }

    const member = await Member.findOne({ _id: req.user.id, committee: req.committee._id });
    if (!member) return res.status(404).json({ success: false, message: "Member not found." });

    member.phone = phone.trim();
    await member.save();
    const { pin: _omit, ...safe } = member.toObject();
    res.json({ success: true, member: safe });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMembers, getMemberById, createMember, updateMember, deleteMember, changeMyPin, updateMyProfile };
