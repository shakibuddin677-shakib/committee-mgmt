const PinResetRequest = require("../models/PinResetRequest");
const Member = require("../models/Member");

// @route  POST /api/committees/:committeeId/pin-reset-request   (PUBLIC — no login required)
// @desc   A locked-out member can't log in to change their own PIN, so this
//         is the one write in the whole API that doesn't require a token.
//         It only ever creates a "pending" request — it can never itself
//         change a PIN, so there's no real abuse risk beyond someone
//         spamming requests for a member they don't own (which the admin
//         simply rejects).
async function requestPinReset(req, res, next) {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: "phone is required." });
    }

    const member = await Member.findOne({ committee: req.committee._id, phone: phone.trim() });
    if (!member) {
      return res.status(404).json({ success: false, message: "No member found with that phone number in this committee." });
    }

    const existing = await PinResetRequest.findOne({ member: member._id, status: "pending" });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "You already have a pending PIN reset request. Please wait for your admin to respond.",
      });
    }

    const request = await PinResetRequest.create({ committee: req.committee._id, member: member._id });
    res.status(201).json({ success: true, request });
  } catch (err) {
    next(err);
  }
}

// @route  GET /api/committees/:committeeId/pin-reset-requests?status=pending   (owning admin only)
async function listPinResetRequests(req, res, next) {
  try {
    const filter = { committee: req.committee._id };
    if (req.query.status) filter.status = req.query.status;
    const requests = await PinResetRequest.find(filter).populate("member", "name phone").sort({ createdAt: -1 });
    res.json({ success: true, count: requests.length, requests });
  } catch (err) {
    next(err);
  }
}

// @route  PUT /api/committees/:committeeId/pin-reset-requests/:id/approve   (owning admin only)
// @desc   Admin picks the member's new PIN (told to them out-of-band —
//         phone call, in person, WhatsApp, etc.) and it's set immediately.
async function approvePinReset(req, res, next) {
  try {
    const { newPin } = req.body;
    if (!newPin || String(newPin).length !== 4) {
      return res.status(400).json({ success: false, message: "newPin must be exactly 4 digits." });
    }

    const request = await PinResetRequest.findOne({ _id: req.params.id, committee: req.committee._id, status: "pending" });
    if (!request) return res.status(404).json({ success: false, message: "PIN reset request not found." });

    const member = await Member.findOne({ _id: request.member, committee: req.committee._id });
    if (!member) return res.status(404).json({ success: false, message: "Member not found in this committee." });

    member.pin = newPin; // pre-save hook re-hashes it
    await member.save();

    request.status = "approved";
    await request.save();

    res.json({ success: true, request });
  } catch (err) {
    next(err);
  }
}

// @route  PUT /api/committees/:committeeId/pin-reset-requests/:id/reject   (owning admin only)
async function rejectPinReset(req, res, next) {
  try {
    const request = await PinResetRequest.findOne({ _id: req.params.id, committee: req.committee._id, status: "pending" });
    if (!request) return res.status(404).json({ success: false, message: "PIN reset request not found." });
    request.status = "rejected";
    request.note = req.body.note || "";
    await request.save();
    res.json({ success: true, request });
  } catch (err) {
    next(err);
  }
}

module.exports = { requestPinReset, listPinResetRequests, approvePinReset, rejectPinReset };
