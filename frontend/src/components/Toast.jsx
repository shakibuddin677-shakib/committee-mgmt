import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { T, fonts } from "../styles/tokens";

const ToastContext = createContext(null);
let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const remove = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    (message, { type = "success", duration = 3200 } = {}) => {
      const id = ++idCounter;
      setToasts((list) => [...list, { id, message, type }]);
      timers.current[id] = setTimeout(() => remove(id), duration);
      return id;
    },
    [remove]
  );

  // Exposes toast("msg"), plus toast.success/.error/.info shorthand helpers,
  // with a stable identity across renders so it's safe in effect deps.
  const toast = useMemo(() => {
    const fn = (message, opts) => push(message, opts);
    fn.success = (message, opts) => push(message, { ...opts, type: "success" });
    fn.error = (message, opts) => push(message, { ...opts, type: "error" });
    fn.info = (message, opts) => push(message, { ...opts, type: "info" });
    return fn;
  }, [push]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };

function ToastViewport({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="toast-viewport"
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || Info;
        const colors = {
          success: { bg: T.surfaceRaised, border: T.line, icon: T.green },
          error: { bg: T.rustTint, border: "#E3C9C2", icon: T.rust },
          info: { bg: T.surfaceRaised, border: T.line, icon: T.gold },
        }[t.type];
        return (
          <div
            key={t.id}
            className="toast-pop"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              boxShadow: T.shadowLg,
              padding: "12px 14px",
              minWidth: 260,
              maxWidth: 360,
              fontFamily: fonts.body,
            }}
          >
            <Icon size={18} color={colors.icon} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 13.5, color: T.ink, lineHeight: 1.4, flex: 1 }}>{t.message}</p>
            <button
              onClick={() => onDismiss(t.id)}
              style={{ border: "none", background: "transparent", color: T.inkFaint, cursor: "pointer", padding: 2, flexShrink: 0 }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
