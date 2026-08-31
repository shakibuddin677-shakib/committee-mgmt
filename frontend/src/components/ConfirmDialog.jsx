import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { T, fonts } from "../styles/tokens";
import { Btn } from "./ui";
import { useI18n } from "../i18n/I18nContext";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { title, body, confirmLabel, danger }
  const resolver = useRef(null);

  // Returns a Promise<boolean> — true if the user confirmed, false if they
  // cancelled or dismissed the dialog. Usage:
  //   const ok = await confirm({ title, body });
  //   if (ok) { ...do the destructive thing... }
  const confirm = useCallback((opts) => {
    setState(opts);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (result) => {
    if (resolver.current) resolver.current(result);
    resolver.current = null;
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && <ConfirmDialog {...state} onSettle={settle} />}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}

function ConfirmDialog({ title, body, confirmLabel, danger = true, onSettle }) {
  const { t } = useI18n();

  return (
    <div
      className="fade-in"
      onClick={() => onSettle(false)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(18,32,25,0.45)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pop-in"
        role="alertdialog"
        aria-modal="true"
        style={{
          background: T.surfaceRaised,
          borderRadius: T.radiusLg,
          boxShadow: T.shadowLg,
          border: `1px solid ${T.line}`,
          padding: 26,
          maxWidth: 400,
          width: "100%",
        }}
      >
        <div
          style={{
            width: 42, height: 42, borderRadius: "50%",
            background: danger ? T.rustTint : T.greenTint,
            color: danger ? T.rust : T.green,
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 14,
          }}
        >
          <AlertTriangle size={20} />
        </div>
        <h3 style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: 700, color: T.ink, margin: 0 }}>{title}</h3>
        <p style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.5, margin: "8px 0 20px 0" }}>{body}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => onSettle(false)}>
            {t("common.cancel")}
          </Btn>
          <Btn variant="danger" style={{ background: danger ? T.rust : T.green, color: T.paper, borderColor: danger ? T.rust : T.green }} onClick={() => onSettle(true)}>
            {confirmLabel || t("confirm.confirmDelete")}
          </Btn>
        </div>
      </div>
    </div>
  );
}
