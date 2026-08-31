const express = require("express");
const router = express.Router({ mergeParams: true });
const { listPinResetRequests, approvePinReset, rejectPinReset } = require("../controllers/pinResetController");
const { committeeAdminOnly } = require("../middleware/committeeAccess");

// req.committee already loaded by the parent committeeRoutes router.
// Note: the public "create a request" endpoint lives directly on
// committeeRoutes.js (before the `protect` middleware) since a locked-out
// member has no token to send — see routes/committeeRoutes.js.
router.get("/", committeeAdminOnly, listPinResetRequests);
router.put("/:id/approve", committeeAdminOnly, approvePinReset);
router.put("/:id/reject", committeeAdminOnly, rejectPinReset);

module.exports = router;
