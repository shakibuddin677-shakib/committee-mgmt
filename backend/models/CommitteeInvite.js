const mongoose = require("mongoose");

// A short-lived code the committee's owner generates and shares (WhatsApp,
// SMS, in person) with another admin account, letting them become a
// co-admin of this one committee. See controllers/coAdminController.js.
const committeeInviteSchema = new mongoose.Schema(
  {
    committee: { type: mongoose.Schema.Types.ObjectId, ref: "Committee", required: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    status: { type: String, enum: ["pending", "used", "revoked"], default: "pending" },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

committeeInviteSchema.index({ committee: 1, status: 1 });

function randomInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

committeeInviteSchema.statics.generateUniqueCode = async function () {
  let code;
  let exists = true;
  while (exists) {
    code = randomInviteCode();
    exists = await this.exists({ code });
  }
  return code;
};

module.exports = mongoose.model("CommitteeInvite", committeeInviteSchema);
