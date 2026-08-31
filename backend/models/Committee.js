const mongoose = require("mongoose");

const ruleSchema = new mongoose.Schema(
  {
    hi: { type: String, trim: true },
    en: { type: String, trim: true },
  },
  { _id: false }
);

const committeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Short join code members use at login, e.g. "AZAD01". Auto-generated if not given.
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    // Other admins this owner has invited to help manage this specific
    // committee (see CommitteeInvite / coAdminController). Co-admins can
    // do everything the owner can EXCEPT invite/remove other co-admins or
    // delete the committee — see middleware/committeeAccess.js.
    coAdmins: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Admin" }], default: [] },
    monthlyDefault: { type: Number, default: 300 },
    // Flat interest rate (%) applied to new loans by default, e.g. 2 means
    // a loan accrues 2% of its principal as interest. Individual loans
    // snapshot this rate at the time they're given/approved (see
    // models/Loan.js), so changing it here never retroactively changes
    // existing loans.
    interestRate: { type: Number, default: 0, min: 0 },
    rules: { type: [ruleSchema], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

committeeSchema.index({ owner: 1 });

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

committeeSchema.statics.generateUniqueCode = async function () {
  let code;
  let exists = true;
  while (exists) {
    code = randomCode();
    exists = await this.exists({ code });
  }
  return code;
};

module.exports = mongoose.model("Committee", committeeSchema);
