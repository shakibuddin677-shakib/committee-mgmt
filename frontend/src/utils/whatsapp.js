// Builds a WhatsApp-ready payment register message and opens WhatsApp
// with it pre-filled, so the admin can pick a group/contact and send.
//
// WhatsApp text formatting supported inline: *bold*, _italic_, and
// ```monospace``` blocks (used here to keep the numbers roughly aligned,
// similar to a spreadsheet row).

const WA_URL_SAFE_LIMIT = 1600; // conservative — some mobile browsers cap wa.me URL length

function pad(str, len) {
  str = String(str);
  return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
}

/**
 * @param {object} committee - { name, code }
 * @param {number} year
 * @param {object[]} members - [{ _id, name, monthlyAmount }]
 * @param {object[]} payments - flat payment records [{ member, month, amount }]
 * @param {string[]} monthNames - 12 short month labels
 */
export function buildPaymentRegisterMessage({ committee, year, members, payments, monthNames }) {
  const getAmount = (memberId, month) => {
    const p = payments.find((p) => (p.member?._id || p.member) === memberId && p.month === month);
    return p ? p.amount : undefined;
  };

  const lines = [];
  lines.push(`*${committee.name}*`);
  lines.push(`Payment Register — ${year}`);
  lines.push("");
  lines.push("```");

  let grandTotal = 0;
  let idx = 0;
  members.forEach((m) => {
    idx += 1;
    const rowTotal = payments
      .filter((p) => (p.member?._id || p.member) === m._id)
      .reduce((s, p) => s + (p.amount || 0), 0);
    grandTotal += rowTotal;

    lines.push(`${idx}. ${m.name}`);
    const monthParts = monthNames.map((mn, month) => {
      const amt = getAmount(m._id, month);
      return `${mn}:${amt !== undefined ? amt : "-"}`;
    });
    // group months 4 per line so it stays readable on a phone screen
    for (let i = 0; i < monthParts.length; i += 4) {
      lines.push("   " + monthParts.slice(i, i + 4).join("  "));
    }
    lines.push(`   Total: ₹${rowTotal.toLocaleString("en-IN")}`);
    lines.push("");
  });

  lines.push("```");
  lines.push(`*Grand Total: ₹${grandTotal.toLocaleString("en-IN")}*`);
  lines.push(`*Members: ${members.length}*`);
  lines.push("");
  lines.push(`_Sent from ${committee.name} — Committee Management_`);

  return lines.join("\n");
}

/**
 * Builds a shorter summary (name + year total only) — used automatically
 * as a fallback when the full detailed message would be too long for a
 * wa.me share link.
 */
export function buildPaymentSummaryMessage({ committee, year, members, payments }) {
  const lines = [];
  lines.push(`*${committee.name}*`);
  lines.push(`Payment Summary — ${year}`);
  lines.push("");
  lines.push("```");

  let grandTotal = 0;
  members.forEach((m, idx) => {
    const rowTotal = payments
      .filter((p) => (p.member?._id || p.member) === m._id)
      .reduce((s, p) => s + (p.amount || 0), 0);
    grandTotal += rowTotal;
    lines.push(`${pad(idx + 1 + ".", 4)}${pad(m.name, 20)} ₹${rowTotal.toLocaleString("en-IN")}`);
  });

  lines.push("```");
  lines.push(`*Grand Total: ₹${grandTotal.toLocaleString("en-IN")}*`);
  lines.push("");
  lines.push(`_Sent from ${committee.name} — Committee Management_`);

  return lines.join("\n");
}

/**
 * Builds the full committee report: payment register + loan ledger + overall
 * totals, in one message — the WhatsApp equivalent of the all-in-one
 * spreadsheet committees often keep by hand (member grid, loan tracking,
 * running balance). `labels` lets the caller pass translated headings
 * (see Dashboard.jsx) while keeping names/numbers as-is.
 *
 * @param {object} committee - { name, code }
 * @param {number} year
 * @param {object[]} members - [{ _id, name, monthlyAmount }]
 * @param {object[]} payments - flat payment records for the year
 * @param {object[]} loans - loan records (any status) for the committee
 * @param {object} summary - { totalCollected, totalLoansGiven, totalRepaid, outstanding, balanceInHand, activeMembers }
 * @param {string[]} monthNames
 * @param {object} [labels] - optional translated label overrides
 */
export function buildCommitteeReportMessage({ committee, year, members, payments, loans, summary, monthNames, labels = {} }) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const getAmount = (memberId, month) => {
    const p = payments.find((p) => (p.member?._id || p.member) === memberId && p.month === month);
    return p ? p.amount : undefined;
  };

  const lines = [];
  lines.push(`*${committee.name}*`);
  lines.push(`${L.title} — ${year}`);
  lines.push(`_${L.generatedOn} ${new Date().toLocaleDateString()}_`);
  lines.push("");

  // --- Payment register ---
  lines.push(`*${L.paymentRegister}*`);
  lines.push("```");
  let grandTotal = 0;
  members.forEach((m, idx) => {
    const rowTotal = payments
      .filter((p) => (p.member?._id || p.member) === m._id)
      .reduce((s, p) => s + (p.amount || 0), 0);
    grandTotal += rowTotal;
    lines.push(`${idx + 1}. ${m.name}`);
    const monthParts = monthNames.map((mn, month) => {
      const amt = getAmount(m._id, month);
      return `${mn}:${amt !== undefined ? amt : "-"}`;
    });
    for (let i = 0; i < monthParts.length; i += 4) {
      lines.push("   " + monthParts.slice(i, i + 4).join("  "));
    }
    lines.push(`   ${L.total}: ₹${rowTotal.toLocaleString("en-IN")}`);
    lines.push("");
  });
  lines.push("```");
  lines.push(`*${L.grandTotal}: ₹${grandTotal.toLocaleString("en-IN")}*`);
  lines.push("");

  // --- Loan ledger — only real loans (skip pending/rejected requests) ---
  const realLoans = (loans || []).filter((l) => l.status === "active" || l.status === "closed");
  lines.push(`*${L.loanDetails}*`);
  if (realLoans.length === 0) {
    lines.push(L.noLoans);
  } else {
    lines.push("```");
    realLoans.forEach((l, idx) => {
      const name = l.member?.name || "?";
      const totalDue = l.totalDue ?? l.amount;
      const repaid = l.repaidAmount || 0;
      const outstanding = Math.max(0, totalDue - repaid);
      const now = new Date();
      const isOverdue = l.status === "active" && l.dueDate && new Date(l.dueDate) < now;
      const statusLabel = l.status === "closed" ? L.closed : isOverdue ? L.overdue : L.active;

      lines.push(`${idx + 1}. ${name}${l.purpose ? " — " + l.purpose : ""}`);
      lines.push(`   ${L.given}: ${l.givenDate ? new Date(l.givenDate).toLocaleDateString() : "—"}   ${L.due}: ${l.dueDate ? new Date(l.dueDate).toLocaleDateString() : "—"}`);
      if (l.interestRate > 0) {
        lines.push(`   ${L.principal}: ₹${l.amount.toLocaleString("en-IN")}  +${L.interest}: ₹${(l.interestAmount || 0).toLocaleString("en-IN")} (${l.interestRate}%)  = ₹${totalDue.toLocaleString("en-IN")}`);
      } else {
        lines.push(`   ${L.amount}: ₹${l.amount.toLocaleString("en-IN")}`);
      }
      lines.push(`   ${L.repaid}: ₹${repaid.toLocaleString("en-IN")}   ${L.balanceRemaining}: ₹${outstanding.toLocaleString("en-IN")}   [${statusLabel}]`);
      lines.push("");
    });
    lines.push("```");
  }
  lines.push("");

  // --- Overall summary ---
  if (summary) {
    lines.push(`*${L.summary}*`);
    lines.push("```");
    lines.push(`${L.totalCollected}:  ₹${(summary.totalCollected || 0).toLocaleString("en-IN")}`);
    lines.push(`${L.totalLoaned}:     ₹${(summary.totalLoansGiven || 0).toLocaleString("en-IN")}`);
    lines.push(`${L.totalRepaid}:     ₹${(summary.totalRepaid || 0).toLocaleString("en-IN")}`);
    lines.push(`${L.outstanding}:     ₹${(summary.outstanding || 0).toLocaleString("en-IN")}`);
    lines.push(`${L.balanceInHand}:   ₹${(summary.balanceInHand || 0).toLocaleString("en-IN")}`);
    lines.push("```");
    lines.push("");
  }

  lines.push(`_${L.sentFrom} ${committee.name} — Committee Management_`);

  return lines.join("\n");
}

/**
 * Condensed fallback for buildCommitteeReportMessage — used automatically
 * when the full version is too long for a reliable wa.me link. Drops the
 * month-by-month breakdown in favour of one line per member, but keeps
 * every loan (those are usually the part people actually need to see).
 */
export function buildCommitteeReportSummaryMessage({ committee, year, members, payments, loans, summary, labels = {} }) {
  const L = { ...DEFAULT_LABELS, ...labels };

  const lines = [];
  lines.push(`*${committee.name}*`);
  lines.push(`${L.title} — ${year} (${L.summary})`);
  lines.push(`_${L.generatedOn} ${new Date().toLocaleDateString()}_`);
  lines.push("");

  lines.push(`*${L.paymentRegister}*`);
  lines.push("```");
  let grandTotal = 0;
  members.forEach((m, idx) => {
    const rowTotal = payments
      .filter((p) => (p.member?._id || p.member) === m._id)
      .reduce((s, p) => s + (p.amount || 0), 0);
    grandTotal += rowTotal;
    lines.push(`${pad(idx + 1 + ".", 4)}${pad(m.name, 20)} ₹${rowTotal.toLocaleString("en-IN")}`);
  });
  lines.push("```");
  lines.push(`*${L.grandTotal}: ₹${grandTotal.toLocaleString("en-IN")}*`);
  lines.push("");

  const realLoans = (loans || []).filter((l) => l.status === "active" || l.status === "closed");
  lines.push(`*${L.loanDetails}*`);
  if (realLoans.length === 0) {
    lines.push(L.noLoans);
  } else {
    lines.push("```");
    realLoans.forEach((l) => {
      const name = l.member?.name || "?";
      const totalDue = l.totalDue ?? l.amount;
      const outstanding = Math.max(0, totalDue - (l.repaidAmount || 0));
      const isOverdue = l.status === "active" && l.dueDate && new Date(l.dueDate) < new Date();
      const statusLabel = l.status === "closed" ? L.closed : isOverdue ? L.overdue : L.active;
      lines.push(`${pad(name, 18)} ${L.balanceRemaining}: ₹${pad(outstanding.toLocaleString("en-IN"), 8)} [${statusLabel}]`);
    });
    lines.push("```");
  }
  lines.push("");

  if (summary) {
    lines.push(`*${L.summary}*`);
    lines.push("```");
    lines.push(`${L.totalCollected}:  ₹${(summary.totalCollected || 0).toLocaleString("en-IN")}`);
    lines.push(`${L.outstanding}:     ₹${(summary.outstanding || 0).toLocaleString("en-IN")}`);
    lines.push(`${L.balanceInHand}:   ₹${(summary.balanceInHand || 0).toLocaleString("en-IN")}`);
    lines.push("```");
    lines.push("");
  }

  lines.push(`_${L.sentFrom} ${committee.name} — Committee Management_`);
  return lines.join("\n");
}

const DEFAULT_LABELS = {
  title: "Committee Report",
  paymentRegister: "Payment Register",
  loanDetails: "Loan Details",
  summary: "Summary",
  total: "Total",
  grandTotal: "Grand Total",
  totalCollected: "Total Collected",
  totalLoaned: "Total Loaned",
  totalRepaid: "Total Repaid",
  outstanding: "Outstanding",
  balanceInHand: "Balance in Hand",
  noLoans: "No loans on record.",
  given: "Given",
  due: "Due",
  amount: "Amount",
  principal: "Principal",
  interest: "Interest",
  repaid: "Repaid",
  balanceRemaining: "Balance remaining",
  active: "Active",
  closed: "Repaid",
  overdue: "OVERDUE",
  generatedOn: "Generated on",
  sentFrom: "Sent from",
};

/**
 * Opens WhatsApp (web or app, whichever the device resolves wa.me to)
 * with the given text pre-filled. If the text is too long for a reliable
 * URL, it's copied to the clipboard instead and WhatsApp opens with a
 * short note asking the user to paste it.
 *
 * @returns {"shared" | "copied" | "failed"}
 */
export async function shareOnWhatsApp(message) {
  const encoded = encodeURIComponent(message);

  if (encoded.length <= WA_URL_SAFE_LIMIT) {
    window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
    return "shared";
  }

  try {
    await navigator.clipboard.writeText(message);
    const note = encodeURIComponent(
      "Your committee's payment register is too long to attach directly — it's been copied to your clipboard. Paste it here (long-press → Paste)."
    );
    window.open(`https://wa.me/?text=${note}`, "_blank", "noopener,noreferrer");
    return "copied";
  } catch {
    return "failed";
  }
}
