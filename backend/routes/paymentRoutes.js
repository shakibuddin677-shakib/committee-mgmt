const express = require("express");
const router = express.Router({ mergeParams: true });
const {
  getPayments,
  getPaymentsForMember,
  recordPayment,
  updatePayment,
  deletePayment,
} = require("../controllers/paymentController");
const { committeeAdminOnly } = require("../middleware/committeeAccess");

router.get("/", committeeAdminOnly, getPayments);
router.post("/", committeeAdminOnly, recordPayment);
router.get("/member/:memberId", getPaymentsForMember); // admin or self
router.put("/:id", committeeAdminOnly, updatePayment);
router.delete("/:id", committeeAdminOnly, deletePayment);

module.exports = router;
