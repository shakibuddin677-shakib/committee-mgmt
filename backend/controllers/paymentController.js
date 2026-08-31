const Payment = require("../models/Payment");
const Member = require("../models/Member");
const { isOwnerOrCoAdmin } = require("../middleware/committeeAccess");

// @route  GET /api/committees/:committeeId/payments?year=2026    (owning admin only)
async function getPayments(req, res, next) {
  try {
    const filter = { committee: req.committee._id };
    if (req.query.year) filter.year = Number(req.query.year);
    const payments = await Payment.find(filter).populate("member", "name phone").sort({ year: 1, month: 1 });
    res.json({ success: true, count: payments.length, payments });
  } catch (err) {
    next(err);
  }
}

// @route  GET /api/committees/:committeeId/payments/member/:memberId?year=2026   (admin, or self)
async function getPaymentsForMember(req, res, next) {
  try {
    if (req.user.role === "member") {
      if (req.user.id !== req.params.memberId) {
        return res.status(403).json({ success: false, message: "You can only view your own payments." });
      }
    } else if (!isOwnerOrCoAdmin(req.committee, req.user.id)) {
      // Bug fix: previously any admin token — from any committee — could
      // read another committee's member's payment history, since only the
      // member-self branch was checked here.
      return res.status(403).json({ success: false, message: "You don't manage this committee." });
    }
    const filter = { committee: req.committee._id, member: req.params.memberId };
    if (req.query.year) filter.year = Number(req.query.year);
    const payments = await Payment.find(filter).sort({ year: 1, month: 1 });
    const total = payments.reduce((sum, p) => sum + p.amount, 0);
    res.json({ success: true, count: payments.length, total, payments });
  } catch (err) {
    next(err);
  }
}

// @route  POST /api/committees/:committeeId/payments        (owning admin only)
// @desc   Records or updates a member's payment for a given month/year.
//         Upserts on (member, year, month), so calling it again for the
//         same month just corrects the amount.
async function recordPayment(req, res, next) {
  try {
    const { member, year, month, amount, note } = req.body;
    if (member === undefined || year === undefined || month === undefined || amount === undefined) {
      return res.status(400).json({ success: false, message: "member, year, month and amount are required." });
    }
    const memberExists = await Member.findOne({ _id: member, committee: req.committee._id });
    if (!memberExists) return res.status(404).json({ success: false, message: "Member not found in this committee." });

    const payment = await Payment.findOneAndUpdate(
      { member, year, month },
      { committee: req.committee._id, member, year, month, amount, note, paidOn: new Date() },
      { new: true, upsert: true, runValidators: true }
    );
    res.status(201).json({ success: true, payment });
  } catch (err) {
    next(err);
  }
}

// @route  PUT /api/committees/:committeeId/payments/:id     (owning admin only)
async function updatePayment(req, res, next) {
  try {
    const { amount, note } = req.body;
    const payment = await Payment.findOne({ _id: req.params.id, committee: req.committee._id });
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found in this committee." });
    if (amount !== undefined) payment.amount = amount;
    if (note !== undefined) payment.note = note;
    await payment.save();
    res.json({ success: true, payment });
  } catch (err) {
    next(err);
  }
}

// @route  DELETE /api/committees/:committeeId/payments/:id  (owning admin only)
async function deletePayment(req, res, next) {
  try {
    const payment = await Payment.findOneAndDelete({ _id: req.params.id, committee: req.committee._id });
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found in this committee." });
    res.json({ success: true, message: "Payment record deleted." });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPayments, getPaymentsForMember, recordPayment, updatePayment, deletePayment };
