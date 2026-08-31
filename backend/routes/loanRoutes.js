const express = require("express");
const router = express.Router({ mergeParams: true });
const {
  getLoans,
  getLoansForMember,
  createLoan,
  updateLoan,
  deleteLoan,
  requestLoan,
  approveLoanRequest,
  rejectLoanRequest,
} = require("../controllers/loanController");
const { committeeAdminOnly, committeeMemberOnly } = require("../middleware/committeeAccess");

router.get("/", committeeAdminOnly, getLoans);
router.post("/", committeeAdminOnly, createLoan);
router.post("/request", committeeMemberOnly, requestLoan);
router.get("/member/:memberId", getLoansForMember); // admin or self
router.put("/:id/approve", committeeAdminOnly, approveLoanRequest);
router.put("/:id/reject", committeeAdminOnly, rejectLoanRequest);
router.put("/:id", committeeAdminOnly, updateLoan);
router.delete("/:id", committeeAdminOnly, deleteLoan);

module.exports = router;
