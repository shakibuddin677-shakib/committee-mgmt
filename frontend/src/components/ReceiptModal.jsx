import React from "react";
import { createPortal } from "react-dom";
import { X, Printer } from "lucide-react";
import { T, fonts, monthNames } from "../styles/tokens";
import { Btn, Rupee } from "./ui";
import { useI18n } from "../i18n/I18nContext";

export default function ReceiptModal({ committee, member, year, month, amount, onClose }) {
  const { t } = useI18n();

  const portalTarget = typeof document !== "undefined" ? document.getElementById("receipt-portal") : null;
  if (!portalTarget) return null;

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
          maxWidth: 400,
          width: "100%",
          boxShadow: T.shadowLg,
        }}
      >
        <div className="receipt-print-area">
          <div style={{ textAlign: "center", marginBottom: 20, borderBottom: `1.5px dashed ${T.line}`, paddingBottom: 16 }}>
            <p style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 18, color: T.green, margin: 0 }}>
              {committee.name}
            </p>
            <p style={{ fontSize: 11, color: T.inkSoft, margin: "4px 0 0 0", fontFamily: fonts.mono }}>
              {committee.code}
            </p>
          </div>

          <p style={{ textAlign: "center", fontSize: 12, color: T.inkSoft, margin: "0 0 18px 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {t("payments.receiptTitle")}
          </p>

          <Row label={t("payments.member")} value={member.name} />
          {member.phone && <Row label={t("common.phone") || "Phone"} value={member.phone} />}
          <Row label={`${monthNames[month]} ${year}`} value={<Rupee value={amount} size={16} />} />
          <Row label={t("payments.receiptIssued")} value={new Date().toLocaleDateString()} />

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

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${T.lineSoft}` }}>
      <span style={{ fontSize: 12.5, color: T.inkSoft }}>{label}</span>
      <span style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
