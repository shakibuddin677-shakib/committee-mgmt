const Payment = require("../models/Payment");
const Loan = require("../models/Loan");
const Member = require("../models/Member");

// @route  GET /api/committees/:committeeId/dashboard/summary
// @desc   Admin (owner) gets this committee's totals. A member of this
//         committee gets only their own numbers within it.
async function getSummary(req, res, next) {
  try {
    const committeeId = req.committee._id;

    // "requested" loans never had money handed over, and "rejected" ones
    // never will — only "active"/"closed" are real, disbursed loans. Bug
    // fix: this used to aggregate over ALL loan documents regardless of
    // status, so a member's pending/rejected loan *requests* were being
    // counted as if the money had actually been given, inflating both the
    // admin's and the member's totals.
    const realLoanFilter = { committee: committeeId, status: { $in: ["active", "closed"] } };

    if (req.user.role === "admin") {
      const [collectedAgg, loans, memberCount] = await Promise.all([
        Payment.aggregate([{ $match: { committee: committeeId } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
        Loan.find(realLoanFilter).select("amount interestRate repaidAmount"),
        Member.countDocuments({ committee: committeeId, active: true }),
      ]);
      const totalCollected = collectedAgg[0]?.total || 0;

      // Bug fix: "outstanding" used to be totalGiven - totalRepaid, which
      // only tracks principal and silently drops any interest that's
      // accrued but not yet paid back. That made the dashboard/report
      // "Outstanding" figure disagree with the per-loan balance shown in
      // the Loan Details table (which correctly includes interest). Now
      // both use the same totalDue - repaidAmount calculation.
      let totalGiven = 0;
      let totalRepaid = 0;
      let outstanding = 0;
      loans.forEach((l) => {
        const interest = Math.round((l.amount || 0) * ((l.interestRate || 0) / 100));
        const totalDue = (l.amount || 0) + interest;
        totalGiven += l.amount || 0;
        totalRepaid += l.repaidAmount || 0;
        outstanding += Math.max(0, totalDue - (l.repaidAmount || 0));
      });
      // Cash actually in hand: money collected, minus principal paid out,
      // plus whatever cash has come back in (principal + any interest
      // already repaid). This is intentionally independent of the
      // interest-inclusive "outstanding" figure above.
      const balanceInHand = totalCollected - totalGiven + totalRepaid;

      return res.json({
        success: true,
        role: "admin",
        committee: { id: committeeId, name: req.committee.name, code: req.committee.code },
        totalCollected,
        totalLoansGiven: totalGiven,
        totalRepaid,
        outstanding,
        balanceInHand,
        activeMembers: memberCount,
      });
    }

    // member view — scoped to this committee AND this member
    const [payments, loans] = await Promise.all([
      Payment.find({ committee: committeeId, member: req.user.id }),
      Loan.find({ committee: committeeId, member: req.user.id, status: { $in: ["active", "closed"] } }),
    ]);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const totalBorrowed = loans.reduce((s, l) => s + l.amount, 0);
    const totalRepaidByMe = loans.reduce((s, l) => s + l.repaidAmount, 0);
    const outstandingLoan = loans.reduce((s, l) => {
      const interest = Math.round((l.amount || 0) * ((l.interestRate || 0) / 100));
      const totalDue = (l.amount || 0) + interest;
      return s + Math.max(0, totalDue - (l.repaidAmount || 0));
    }, 0);

    res.json({
      success: true,
      role: "member",
      committee: { id: committeeId, name: req.committee.name, code: req.committee.code },
      totalPaid,
      totalBorrowed,
      totalRepaidByMe,
      outstandingLoan,
      paymentCount: payments.length,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSummary };
