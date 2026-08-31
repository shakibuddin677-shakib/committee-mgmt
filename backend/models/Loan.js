const mongoose = require("mongoose");

const loanSchema = new mongoose.Schema(
  {
    committee: { type: mongoose.Schema.Types.ObjectId, ref: "Committee", required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
    amount: { type: Number, required: true, min: 0 },
    purpose: { type: String, trim: true, default: "" },
    // Not required at the schema level: a member-initiated request has
    // neither until an admin approves it and sets both.
    givenDate: { type: Date },
    dueDate: { type: Date },
    repaidAmount: { type: Number, default: 0 },
    // Flat interest rate (%), snapshotted from the committee's default at
    // the moment the loan is given/approved (or overridden by the admin
    // right then). Changing the committee's default later never changes
    // this loan's rate — see interestAmount/totalDue virtuals below.
    interestRate: { type: Number, default: 0, min: 0 },
    // "requested" — member asked for a loan, awaiting admin review
    // "rejected"  — admin declined the request
    // "active"    — a real, outstanding loan (admin-given, or an approved request)
    // "closed"    — fully repaid
    status: { type: String, enum: ["requested", "rejected", "active", "closed"], default: "active" },
    rejectionNote: { type: String, trim: true, default: "" },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

loanSchema.index({ committee: 1, status: 1 });

// interest = principal * rate% ; totalDue = principal + interest.
// These are computed, not stored, so they always reflect this loan's own
// (amount, interestRate) — never stale even if amount/interestRate get
// edited later.
loanSchema.virtual("interestAmount").get(function () {
  return Math.round((this.amount || 0) * ((this.interestRate || 0) / 100));
});
loanSchema.virtual("totalDue").get(function () {
  return (this.amount || 0) + this.interestAmount;
});

module.exports = mongoose.model("Loan", loanSchema);
