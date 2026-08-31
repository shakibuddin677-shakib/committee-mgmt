import React, { useState, useCallback } from "react";
import {
  LayoutDashboard, Users, Wallet, HandCoins, Settings, LogOut, Building2, Menu, X,
} from "lucide-react";
import { T, fonts } from "../styles/tokens";
import { Avatar } from "./ui";
import { useI18n, LanguageSwitcher } from "../i18n/I18nContext";
import NotificationBell from "./NotificationBell";
import { useToast } from "./Toast";
import { useIdleLogout } from "../hooks/useIdleLogout";
import { touchSession } from "../utils/session";

export default function Layout({ session, activePage, onNavigate, onLogout, children, idleResumeMs }) {
  const isAdmin = session.role === "admin";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { t } = useI18n();
  const toast = useToast();

  // Stable identity across renders — otherwise the idle timer would reset
  // on every Layout re-render, not just real mouse/keyboard activity.
  const handleIdleWarning = useCallback(() => toast.info(t("session.idleWarning")), [toast, t]);
  const handleActivity = useCallback(() => touchSession(), []);

  // Auto-logout after 20 minutes of no interaction, with a warning toast
  // a minute before — this app is often used on a shared family device.
  // `idleResumeMs` (from a restored session — see utils/session.js and
  // App.jsx) makes a page refresh resume the same countdown instead of
  // silently restarting a full 20 minutes.
  useIdleLogout({
    onLogout,
    onWarning: handleIdleWarning,
    onActivity: handleActivity,
    timeoutMs: 20 * 60 * 1000,
    warnBeforeMs: 60 * 1000,
    initialRemainingMs: idleResumeMs,
  });

  const navItems = [
    { id: "dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { id: "members", label: isAdmin ? t("nav.members") : t("nav.profile"), icon: Users },
    { id: "payments", label: t("nav.payments"), icon: Wallet },
    { id: "loans", label: t("nav.loans"), icon: HandCoins },
    ...(isAdmin ? [{ id: "settings", label: t("nav.settings"), icon: Settings }] : []),
  ];

  const activeLabel = navItems.find((n) => n.id === activePage)?.label || t("nav.dashboard");
  const userName = session.adminUser?.name || session.memberUser?.name;

  const go = (id) => {
    onNavigate(id);
    setDrawerOpen(false);
  };

  return (
    <div style={{ fontFamily: fonts.body, background: T.paper, minHeight: "100vh", display: "flex" }}>
      {/* Mobile topbar */}
      <div
        className="mobile-topbar"
        style={{
          display: "none",
          position: "fixed",
          top: 0, left: 0, right: 0,
          zIndex: 30,
          height: 56,
          background: T.green,
          color: T.paper,
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          boxShadow: "0 2px 10px rgba(18,32,25,0.18)",
        }}
      >
        <button
          onClick={() => setDrawerOpen(true)}
          className="icon-btn"
          style={{ background: "transparent", border: "none", color: T.paper, padding: 8, borderRadius: 8, cursor: "pointer" }}
        >
          <Menu size={20} />
        </button>
        <span style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 15 }}>{activeLabel}</span>
        <Avatar name={userName} size={30} tone="gold" />
      </div>

      {drawerOpen && (
        <div
          className="drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(18,32,25,0.45)", zIndex: 35 }}
        />
      )}

      <div
        className={`app-sidebar sidebar ${drawerOpen ? "open" : ""}`}
        style={{
          width: 222,
          background: `linear-gradient(185deg, ${T.green}, ${T.greenDeep})`,
          color: T.paper,
          display: "flex",
          flexDirection: "column",
          padding: "22px 0",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setDrawerOpen(false)}
          className="icon-btn drawer-close-btn"
          style={{
            display: "none",
            position: "absolute", top: 14, right: 14,
            background: "transparent", border: "none", color: T.paper, padding: 6, borderRadius: 8, cursor: "pointer",
          }}
        >
          <X size={18} />
        </button>

        <div style={{ padding: "0 20px 20px", borderBottom: "1px solid rgba(244,239,224,0.14)", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
            <div
              style={{
                width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${T.gold}`,
                display: "flex", alignItems: "center", justifyContent: "center", color: T.gold, flexShrink: 0,
              }}
            >
              <Building2 size={15} />
            </div>
            <p style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 15, margin: 0, lineHeight: 1.3 }}>
              {session.committee.name}
            </p>
          </div>
          <p style={{ fontSize: 10.5, opacity: 0.7, margin: 0, fontFamily: fonts.mono, letterSpacing: "0.06em" }}>
            {session.committee.code}
          </p>
        </div>

        <div style={{ padding: "0 20px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={userName} size={34} tone="gold" />
          <div style={{ overflow: "hidden", flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {userName}
            </p>
            <p style={{ margin: 0, fontSize: 11, opacity: 0.65 }}>{isAdmin ? t("common.admin") : t("common.member")}</p>
          </div>
          <NotificationBell session={session} tone="light" />
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 10px" }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className="nav-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: active ? "rgba(244,239,224,0.14)" : "transparent",
                  border: "none",
                  borderLeft: `3px solid ${active ? T.gold : "transparent"}`,
                  color: T.paper,
                  fontSize: 13.5,
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <Icon size={16} style={{ opacity: active ? 1 : 0.85 }} /> {item.label}
              </button>
            );
          })}
        </nav>

        <div style={{ marginTop: "auto", padding: "16px 20px 0", display: "flex", flexDirection: "column", gap: 8 }}>
          <LanguageSwitcher tone="light" />
          <button
            onClick={onLogout}
            className="icon-btn"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: "rgba(244,239,224,0.04)",
              border: "1px solid rgba(244,239,224,0.22)",
              color: T.paper,
              borderRadius: 8,
              padding: "9px 12px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              width: "100%",
            }}
          >
            <LogOut size={14} /> {t("common.logout")}
          </button>
        </div>
      </div>

      <div className="app-main fade-in" style={{ flex: 1, padding: "28px 32px", overflowY: "auto", minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
