import React from "react";
import { AlertCircle, Inbox } from "lucide-react";
import { T, fonts } from "../styles/tokens";

export function Card({ children, style, hover = false, className = "" }) {
  return (
    <div
      className={`app-card ${hover ? "card-hover" : ""} ${className}`.trim()}
      style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: T.radiusMd,
        padding: "22px 24px",
        boxShadow: T.shadowSm,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Btn({ children, onClick, variant = "ghost", style, type = "button", disabled, size = "md" }) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    fontFamily: fonts.body,
    fontSize: size === "sm" ? 13 : 14,
    fontWeight: 600,
    padding: size === "sm" ? "8px 14px" : "10.5px 19px",
    borderRadius: T.radiusSm,
    cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid transparent",
    opacity: disabled ? 0.55 : 1,
    letterSpacing: "0.01em",
  };
  const variants = {
    primary: {
      background: `linear-gradient(155deg, ${T.greenSoft}, ${T.green} 60%, ${T.greenDeep})`,
      color: T.paper,
      borderColor: T.greenDeep,
      boxShadow: "0 6px 16px rgba(18,32,25,0.24)",
    },
    gold: {
      background: `linear-gradient(155deg, ${T.goldSoft}, ${T.gold})`,
      color: "#2A2110",
      borderColor: T.gold,
      boxShadow: T.shadowGold,
    },
    ghost: { background: T.surface, color: T.green, borderColor: T.line },
    danger: { background: "transparent", color: T.rust, borderColor: "#E3C9C2" },
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="btn-lift"
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

export function Input(props) {
  return (
    <input
      {...props}
      style={{
        fontFamily: fonts.body,
        fontSize: 16,
        padding: "10.5px 13px",
        borderRadius: 8,
        border: `1px solid ${T.line}`,
        background: T.surface,
        color: T.ink,
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        ...props.style,
      }}
    />
  );
}

export function Label({ children }) {
  return (
    <label style={{ fontSize: 12.5, color: T.inkSoft, display: "block", marginBottom: 6, fontWeight: 600, letterSpacing: "0.01em" }}>
      {children}
    </label>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div
      className="fade-up"
      style={{
        display: "flex",
        gap: 9,
        alignItems: "flex-start",
        background: T.rustTint,
        border: "1px solid #E3C9C2",
        borderRadius: 9,
        padding: "11px 13px",
        marginTop: 14,
      }}
    >
      <AlertCircle size={16} color={T.rust} style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ margin: 0, fontSize: 13, color: T.rust, lineHeight: 1.45 }}>{message}</p>
    </div>
  );
}

export function Spinner({ size = 15, color }) {
  return (
    <span
      className="spin"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid ${T.line}`,
        borderTopColor: color || T.green,
        borderRadius: "50%",
        flexShrink: 0,
      }}
    />
  );
}

export function LoadingRow({ label }) {
  return (
    <div className="fade-in" style={{ display: "flex", alignItems: "center", gap: 9, color: T.inkSoft, fontSize: 14, padding: "8px 0" }}>
      <Spinner /> {label}
    </div>
  );
}

export function Skeleton({ width = "100%", height = 14, style }) {
  return <div className="skeleton" style={{ width, height, ...style }} />;
}

export function SectionTitle({ children, subtitle, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
      <div>
        <h2 style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 23, color: T.green, margin: 0, letterSpacing: "-0.01em" }}>
          {children}
        </h2>
        {subtitle && <p style={{ margin: "4px 0 0 0", fontSize: 13, color: T.inkSoft }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Rupee({ value, size = 15, color, weight = 600 }) {
  const negative = value < 0;
  return (
    <span
      style={{
        fontFamily: fonts.mono,
        fontSize: size,
        fontWeight: weight,
        color: color || (negative ? T.rust : T.ink),
        letterSpacing: "-0.01em",
      }}
    >
      {negative ? "−" : ""}₹{Math.abs(Math.round(value || 0)).toLocaleString("en-IN")}
    </span>
  );
}

export function Seal({ children, tone = "green" }) {
  const map = {
    rust: { color: T.rust, bg: T.rustTint },
    gold: { color: "#8A6416", bg: T.goldTint },
    green: { color: T.green, bg: T.greenTint },
    gray: { color: T.inkSoft, bg: T.paper2 },
  };
  const c = map[tone] || map.green;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        justifyContent: "center",
        background: c.bg,
        color: c.color,
        borderRadius: 999,
        padding: "3.5px 11px",
        fontFamily: fonts.mono,
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.color, display: "inline-block" }} />
      {children}
    </span>
  );
}

export function Avatar({ name, size = 36, tone = "green" }) {
  const initials = (name || "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const bg = tone === "gold"
    ? `linear-gradient(155deg, ${T.goldSoft}, ${T.gold})`
    : `linear-gradient(155deg, ${T.greenSoft}, ${T.greenDeep})`;
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: bg, color: T.paper,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: fonts.display, fontWeight: 600, fontSize: size * 0.4,
        flexShrink: 0, boxShadow: "0 2px 6px rgba(18,32,25,0.2)",
      }}
    >
      {initials}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, subtitle, action }) {
  return (
    <div
      className="fade-up"
      style={{
        textAlign: "center",
        padding: "48px 20px",
        border: `1.5px dashed ${T.line}`,
        borderRadius: T.radiusMd,
        background: "rgba(255,253,247,0.5)",
      }}
    >
      <div
        style={{
          width: 46, height: 46, borderRadius: "50%", background: T.greenTint, color: T.green,
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
        }}
      >
        <Icon size={20} />
      </div>
      <p style={{ margin: 0, fontFamily: fonts.display, fontWeight: 600, fontSize: 15.5, color: T.ink }}>{title}</p>
      {subtitle && <p style={{ margin: "5px 0 0 0", fontSize: 13, color: T.inkSoft, maxWidth: 340, marginLeft: "auto", marginRight: "auto" }}>{subtitle}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
