const Committee = require("../models/Committee");
const Member = require("../models/Member");
const Payment = require("../models/Payment");
const Loan = require("../models/Loan");

// @route  POST /api/committees          (admin only — create a new committee)
// @desc   Any logged-in admin can create as many committees as they want.
//         A join code is generated so members can find the right committee
//         at login; the admin can also supply their own code.
async function createCommittee(req, res, next) {
  try {
    const { name, code, monthlyDefault, rules } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: "name is required." });
    }

    let finalCode = code ? code.trim().toUpperCase() : await Committee.generateUniqueCode();
    if (code) {
      const clash = await Committee.findOne({ code: finalCode });
      if (clash) {
        return res.status(409).json({ success: false, message: "That committee code is already taken. Try another." });
      }
    }

    const committee = await Committee.create({
      name,
      code: finalCode,
      owner: req.user.id,
      monthlyDefault: monthlyDefault || 300,
      interestRate: req.body.interestRate || 0,
      rules: rules || [],
    });

    res.status(201).json({ success: true, committee });
  } catch (err) {
    next(err);
  }
}

// @route  GET /api/committees           (admin only — committees I own OR co-manage)
async function getMyCommittees(req, res, next) {
  try {
    const committees = await Committee.find({
      $or: [{ owner: req.user.id }, { coAdmins: req.user.id }],
    }).sort({ createdAt: -1 });
    res.json({ success: true, count: committees.length, committees });
  } catch (err) {
    next(err);
  }
}

// @route  GET /api/committees/:committeeId     (owning admin, or a member of it)
// @desc   req.committee is already loaded and access already checked by
//         middleware by the time this runs.
async function getCommitteeById(req, res, next) {
  res.json({ success: true, committee: req.committee });
}

// @route  GET /api/committees/lookup/:code     (public — used by the member
//         login screen to confirm a code is real before asking for phone/pin)
async function lookupByCode(req, res, next) {
  try {
    const committee = await Committee.findOne({ code: req.params.code.trim().toUpperCase() }).select("name code active");
    if (!committee) {
      return res.status(404).json({ success: false, message: "No committee found with that code." });
    }
    res.json({ success: true, committee });
  } catch (err) {
    next(err);
  }
}

// @route  PUT /api/committees/:committeeId     (owner or co-admin)
async function updateCommittee(req, res, next) {
  try {
    const { name, monthlyDefault, interestRate, rules, active } = req.body;
    const committee = req.committee;
    if (name !== undefined) committee.name = name;
    if (monthlyDefault !== undefined) committee.monthlyDefault = monthlyDefault;
    if (interestRate !== undefined) committee.interestRate = Math.max(0, Number(interestRate) || 0);
    if (rules !== undefined) committee.rules = rules;
    if (active !== undefined) committee.active = active;
    await committee.save();
    res.json({ success: true, committee });
  } catch (err) {
    next(err);
  }
}

// @route  DELETE /api/committees/:committeeId  (owner only)
// @desc   Deletes the committee and everything under it — members, payments,
//         loans. This is destructive, so a frontend should confirm first.
async function deleteCommittee(req, res, next) {
  try {
    const PinResetRequest = require("../models/PinResetRequest");
    const CommitteeInvite = require("../models/CommitteeInvite");
    const committeeId = req.committee._id;

    await Promise.all([
      Payment.deleteMany({ committee: committeeId }),
      Loan.deleteMany({ committee: committeeId }),
      Member.deleteMany({ committee: committeeId }),
      PinResetRequest.deleteMany({ committee: committeeId }),
      CommitteeInvite.deleteMany({ committee: committeeId }),
    ]);
    await req.committee.deleteOne();

    res.json({ success: true, message: "Committee and all its data have been deleted." });
  } catch (err) {
    next(err);
  }
}

// @route  GET /api/committees/:committeeId/export     (owner or co-admin)
// @desc   A full JSON snapshot of everything under this committee — for an
//         admin who wants their own offline backup, or to migrate data.
//         Member PINs are never included (they're hashed anyway, but we
//         exclude the field entirely rather than rely on that).
async function exportCommittee(req, res, next) {
  try {
    const committeeId = req.committee._id;

    const [members, payments, loans] = await Promise.all([
      Member.find({ committee: committeeId }).select("-pin"),
      Payment.find({ committee: committeeId }),
      Loan.find({ committee: committeeId }),
    ]);

    res.json({
      success: true,
      exportedAt: new Date().toISOString(),
      committee: req.committee,
      members,
      payments,
      loans,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createCommittee,
  getMyCommittees,
  getCommitteeById,
  lookupByCode,
  updateCommittee,
  deleteCommittee,
  exportCommittee,
};
