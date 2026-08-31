import React from "react";
import { createPortal } from "react-dom";
import { X, Printer } from "lucide-react";
import { T, fonts, monthNames } from "../styles/tokens";
import { Btn, Rupee, Seal } from "./ui";
import { useI18n } from "../i18n/I18nContext";

// Full-year printable statement for a member — their payment history plus
// loan history for the given committee/year. Renders through the same
// #receipt-portal used by ReceiptModal, so it shares the same print CSS
// (see index.css @media print rules) without any extra wiring.
export default function StatementModal({ committee, member, year, payments, loans, onClose }) {
  const { t } = useI18n();

  const portalTarget = typeof document !== "undefined" ? document.getElementById("receipt-portal") : null;
  if (!portalTarget) return null;

  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Bug fix: this used to print the raw backend status word ("active",
  // "closed", "requested", "rejected") directly — always in English, even
  // when the app is set to Hindi. Translate it the same way Loans.jsx does.
  const statusLabel = (l) => {
    if (l.status === "requested") return t("loans.pending");
    if (l.status === "rejected") return t("loans.rejected");
    if (l.status === "closed") return t("loans.repaid");
    const overdue = l.status === "active" && l.dueDate && new Date(l.dueDate) < new Date();
    return overdue ? t("loans.overdue") : t("loans.outstanding");
  };

  const modal = (
    <div
      className="fade-in receipt-modal-backdrop"
      style={{
        position: "fixed", inset: 0, zIndex: 9997,
        background: "rgba(18,32,25,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="pop-in receipt-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.surfaceRaised || T.surface,
          borderRadius: T.radiusMd,
          padding: "28px 30px",
          maxWidth: 440,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: T.shadowLg,
        }}
      >
        <div className="receipt-print-area">
          <div style={{ textAlign: "center", marginBottom: 18, borderBottom: `1.5px dashed ${T.line}`, paddingBottom: 16 }}>
            <p style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 18, color: T.green, margin: 0 }}>
              {committee.name}
            </p>
            <p style={{ fontSize: 11, color: T.inkSoft, margin: "4px 0 0 0", fontFamily: fonts.mono }}>
              {committee.code}
            </p>
          </div>

          <p style={{ textAlign: "center", fontSize: 12, color: T.inkSoft, margin: "0 0 4px 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {t("statement.title")}
          </p>
          <p style={{ textAlign: "center", fontSize: 15, fontWeight: 700, color: T.ink, margin: "0 0 18px 0" }}>
            {member.name} · {t("statement.year")} {year}
          </p>

          <p style={{ fontSize: 12.5, fontWeight: 700, color: T.green, margin: "0 0 8px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {t("statement.paymentsHeading")}
          </p>
          {payments.length === 0 ? (
            <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "0 0 16px 0" }}>{t("statement.noPayments")}</p>
          ) : (
            <div style={{ marginBottom: 8 }}>
              {monthNames.map((mn, month) => {
                const p = payments.find((pay) => pay.month === month);
                if (!p) return null;
                return (
                  <div key={month} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.lineSoft}` }}>
                    <span style={{ fontSize: 12.5, color: T.inkSoft }}>{mn} {year}</span>
                    <span style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}><Rupee value={p.amount} size={13} /></span>
                  </div>
                );
              })}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0 0", marginTop: 4 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: T.green }}>{t("statement.totalPaid")}</span>
                <Rupee value={totalPaid} size={14} />
              </div>
            </div>
          )}

          <p style={{ fontSize: 12.5, fontWeight: 700, color: T.green, margin: "18px 0 8px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {t("statement.loansHeading")}
          </p>
          {loans.length === 0 ? (
            <p style={{ fontSize: 12.5, color: T.inkSoft, margin: 0 }}>{t("statement.noLoans")}</p>
          ) : (
            loans.map((l) => (
              <div key={l._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${T.lineSoft}`, gap: 8 }}>
                <span style={{ fontSize: 12.5, color: T.inkSoft }}>
                  {l.givenDate ? new Date(l.givenDate).toLocaleDateString() : "—"}
                  {l.purpose ? ` · ${l.purpose}` : ""}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <Rupee value={l.amount} size={13} />
                  <Seal tone={l.status === "closed" ? "green" : l.status === "rejected" ? "gray" : "gold"}>{statusLabel(l)}</Seal>
                </div>
              </div>
            ))
          )}

          <p style={{ textAlign: "center", fontSize: 10.5, color: T.inkFaint, marginTop: 20 }}>
            {t("payments.receiptFooter")}
          </p>
        </div>

        <div className="receipt-actions" style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}><X size={14} /> {t("common.close")}</Btn>
          <Btn variant="primary" onClick={() => window.print()} style={{ flex: 1 }}><Printer size={14} /> {t("payments.printReceipt")}</Btn>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, portalTarget);
}
