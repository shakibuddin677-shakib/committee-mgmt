const express = require("express");
const router = express.Router({ mergeParams: true });
const { getSummary } = require("../controllers/dashboardController");
const { committeeAdminOrMember } = require("../middleware/committeeAccess");

router.get("/summary", committeeAdminOrMember, getSummary);

module.exports = router;
