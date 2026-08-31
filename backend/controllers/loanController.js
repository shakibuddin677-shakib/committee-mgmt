const Loan = require("../models/Loan");
const Member = require("../models/Member");
const { isOwnerOrCoAdmin } = require("../middleware/committeeAccess");

// @route  GET /api/committees/:committeeId/loans?status=active     (owning admin only)
async function getLoans(req, res, next) {
  try {
    const filter = { committee: req.committee._id };
    if (req.query.status) filter.status = req.query.status;
    const loans = await Loan.find(filter).populate("member", "name phone").sort({ givenDate: -1 });
    res.json({ success: true, count: loans.length, loans });
  } catch (err) {
    next(err);
  }
}

// @route  GET /api/committees/:committeeId/loans/member/:memberId   (admin, or self)
async function getLoansForMember(req, res, next) {
  try {
    if (req.user.role === "member") {
      if (req.user.id !== req.params.memberId) {
        return res.status(403).json({ success: false, message: "You can only view your own loans." });
      }
    } else if (!isOwnerOrCoAdmin(req.committee, req.user.id)) {
      // Bug fix: previously any admin token — from any committee — could
      // read another committee's member's loan history, since only the
      // member-self branch was checked here.
      return res.status(403).json({ success: false, message: "You don't manage this committee." });
    }
    const loans = await Loan.find({ committee: req.committee._id, member: req.params.memberId }).sort({ givenDate: -1 });
    res.json({ success: true, count: loans.length, loans });
  } catch (err) {
    next(err);
  }
}

// @route  POST /api/committees/:committeeId/loans           (owning admin only)
async function createLoan(req, res, next) {
  try {
    const { member, amount, purpose, givenDate, dueDate, interestRate } = req.body;
    if (!member || !amount || !givenDate || !dueDate) {
      return res.status(400).json({ success: false, message: "member, amount, givenDate and dueDate are required." });
    }
    const memberExists = await Member.findOne({ _id: member, committee: req.committee._id });
    if (!memberExists) return res.status(404).json({ success: false, message: "Member not found in this committee." });

    // Falls back to the committee's default rate; the admin can override
    // per loan (e.g. 0% for a genuine hardship case).
    const rate = interestRate !== undefined ? Math.max(0, Number(interestRate) || 0) : req.committee.interestRate || 0;

    const loan = await Loan.create({ committee: req.committee._id, member, amount, purpose, givenDate, dueDate, interestRate: rate });
    res.status(201).json({ success: true, loan });
  } catch (err) {
    next(err);
  }
}

// @route  PUT /api/committees/:committeeId/loans/:id        (owning admin only)
async function updateLoan(req, res, next) {
  try {
    const { repaidAmount, status, dueDate, purpose, interestRate } = req.body;
    const loan = await Loan.findOne({ _id: req.params.id, committee: req.committee._id });
    if (!loan) return res.status(404).json({ success: false, message: "Loan not found in this committee." });

    if (repaidAmount !== undefined) loan.repaidAmount = repaidAmount;
    if (status !== undefined) loan.status = status;
    if (dueDate !== undefined) loan.dueDate = dueDate;
    if (purpose !== undefined) loan.purpose = purpose;
    if (interestRate !== undefined) loan.interestRate = Math.max(0, Number(interestRate) || 0);

    // "Repaid in full" means principal + interest, not just principal.
    const totalDue = loan.amount + Math.round(loan.amount * (loan.interestRate / 100));
    if (loan.repaidAmount >= totalDue) {
      loan.status = "closed";
    } else if (loan.status === "closed") {
      // Bug fix: this only ever forced a loan closed, never reopened one.
      // If an admin corrects a previously-recorded repaidAmount back down
      // below the total due (e.g. fixing a typo), the loan needs to go
      // back to "active" instead of silently staying "closed" while still
      // owing money.
      loan.status = "active";
    }

    await loan.save();
    res.json({ success: true, loan });
  } catch (err) {
    next(err);
  }
}

// @route  DELETE /api/committees/:committeeId/loans/:id     (owning admin only)
async function deleteLoan(req, res, next) {
  try {
    const loan = await Loan.findOneAndDelete({ _id: req.params.id, committee: req.committee._id });
    if (!loan) return res.status(404).json({ success: false, message: "Loan not found in this committee." });
    res.json({ success: true, message: "Loan record deleted." });
  } catch (err) {
    next(err);
  }
}

// @route  POST /api/committees/:committeeId/loans/request   (member only, self)
// @desc   A member asks for a loan. Creates a Loan with status "requested"
//         and no givenDate/dueDate yet — those are set when an admin
//         approves it. The member field is taken from the token, never
//         the request body, so a member can only ever request for themself.
async function requestLoan(req, res, next) {
  try {
    const { amount, purpose } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "A valid amount is required." });
    }
    const loan = await Loan.create({
      committee: req.committee._id,
      member: req.user.id,
      amount,
      purpose,
      status: "requested",
    });
    res.status(201).json({ success: true, loan });
  } catch (err) {
    next(err);
  }
}

// @route  PUT /api/committees/:committeeId/loans/:id/approve   (owning admin only)
// @desc   Turns a "requested" loan into a real, active one. givenDate and
//         dueDate are required here since the request never had them; the
//         admin can also adjust the amount before approving.
async function approveLoanRequest(req, res, next) {
  try {
    const { givenDate, dueDate, amount, interestRate } = req.body;
    if (!givenDate || !dueDate) {
      return res.status(400).json({ success: false, message: "givenDate and dueDate are required to approve a loan." });
    }
    const loan = await Loan.findOne({ _id: req.params.id, committee: req.committee._id, status: "requested" });
    if (!loan) return res.status(404).json({ success: false, message: "Loan request not found." });

    loan.status = "active";
    loan.givenDate = givenDate;
    loan.dueDate = dueDate;
    if (amount) loan.amount = amount;
    // Requested loans have no rate yet — default to the committee's, same
    // as an admin-given loan, unless the admin overrides it here.
    loan.interestRate = interestRate !== undefined ? Math.max(0, Number(interestRate) || 0) : req.committee.interestRate || 0;
    await loan.save();
    res.json({ success: true, loan });
  } catch (err) {
    next(err);
  }
}

// @route  PUT /api/committees/:committeeId/loans/:id/reject   (owning admin only)
async function rejectLoanRequest(req, res, next) {
  try {
    const loan = await Loan.findOne({ _id: req.params.id, committee: req.committee._id, status: "requested" });
    if (!loan) return res.status(404).json({ success: false, message: "Loan request not found." });
    loan.status = "rejected";
    loan.rejectionNote = req.body.note || "";
    await loan.save();
    res.json({ success: true, loan });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getLoans,
  getLoansForMember,
  createLoan,
  updateLoan,
  deleteLoan,
  requestLoan,
  approveLoanRequest,
  rejectLoanRequest,
};
