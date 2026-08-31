const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const memberSchema = new mongoose.Schema(
  {
    committee: { type: mongoose.Schema.Types.ObjectId, ref: "Committee", required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    pin: { type: String, required: true, minlength: 4 }, // 4-digit login PIN, hashed
    joinedDate: { type: Date, default: Date.now },
    monthlyAmount: { type: Number, default: 300 },
    active: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
  },
  { timestamps: true }
);

// A phone number only needs to be unique within one committee — the same
// person's number could theoretically be entered for two different
// committees they belong to.
memberSchema.index({ committee: 1, phone: 1 }, { unique: true });

memberSchema.pre("save", async function (next) {
  if (!this.isModified("pin")) return next();
  this.pin = await bcrypt.hash(this.pin, 10);
  next();
});

memberSchema.methods.comparePin = function (candidate) {
  return bcrypt.compare(candidate, this.pin);
};

module.exports = mongoose.model("Member", memberSchema);
