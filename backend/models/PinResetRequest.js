const mongoose = require("mongoose");

// Created when a member forgets their PIN and can't log in to change it
// themselves (see memberController.changeMyPin for the self-service path
// that's used once they ARE logged in). This is the "I'm locked out"
// escape hatch — a public endpoint creates one of these, and only the
// committee's admin can act on it.
const pinResetRequestSchema = new mongoose.Schema(
  {
    committee: { type: mongoose.Schema.Types.ObjectId, ref: "Committee", required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    note: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

pinResetRequestSchema.index({ committee: 1, status: 1 });

module.exports = mongoose.model("PinResetRequest", pinResetRequestSchema);
