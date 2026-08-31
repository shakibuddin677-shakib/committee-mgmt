const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    committee: { type: mongoose.Schema.Types.ObjectId, ref: "Committee", required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 0, max: 11 }, // 0 = Jan ... 11 = Dec
    amount: { type: Number, required: true, min: 0 },
    paidOn: { type: Date, default: Date.now },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

// one payment record per member per month per year
paymentSchema.index({ member: 1, year: 1, month: 1 }, { unique: true });
paymentSchema.index({ committee: 1, year: 1 });

module.exports = mongoose.model("Payment", paymentSchema);
