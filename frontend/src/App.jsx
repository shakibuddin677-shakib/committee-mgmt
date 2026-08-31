import React, { useState, useCallback } from "react";
import { BookOpen, ShieldCheck, UserRound, ArrowRight } from "lucide-react";
import Onboarding from "./pages/Onboarding";
import MemberLogin from "./pages/MemberLogin";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import Payments from "./pages/Payments";
import Loans from "./pages/Loans";
import Settings from "./pages/Settings";
import { T, fonts } from "./styles/tokens";
import { useI18n, LanguageSwitcher } from "./i18n/I18nContext";
import { loadSession, saveSession, clearSession } from "./utils/session";

function RoleCard({ icon: Icon, title, subtitle, onClick, delay }) {
  return (
    <button
      onClick={onClick}
      className="fade-up card-hover btn-lift"
      style={{
        display: "flex", alignItems: "center", gap: 14, padding: "18px 20px",
        borderRadius: T.radiusMd, border: `1px solid ${T.line}`, background: T.surface,
        cursor: "pointer", textAlign: "left", width: "100%", boxShadow: T.shadowSm,
        animationDelay: `${delay}ms`,
      }}
    >
      <div
        style={{
          width: 42, height: 42, borderRadius: 10, flexShrink: 0,
          background: T.greenTint, color: T.green,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Icon size={20} />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: T.ink, fontFamily: fonts.display }}>{title}</p>
        <p style={{ margin: "2px 0 0 0", fontSize: 12.5, color: T.inkSoft }}>{subtitle}</p>
      </div>
      <ArrowRight size={16} color={T.inkFaint} />
    </button>
  );
}

function RoleChoice({ onChoose }) {
  const { t } = useI18n();
  return (
    <div
      className="auth-shell"
      style={{
        fontFamily: fonts.body,
        background: `radial-gradient(circle at 15% 8%, ${T.goldTint} 0%, transparent 42%), radial-gradient(circle at 85% 92%, ${T.greenTint} 0%, transparent 45%), ${T.paper}`,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", top: 16, insetInlineEnd: 16 }}>
        <LanguageSwitcher tone="dark" align="right" />
      </div>
      <div className="fade-up" style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
        <div
          style={{
            width: 70, height: 70, borderRadius: "50%",
            overflow: "hidden",
            margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center",
            background: T.surface, boxShadow: T.shadowGreen,
          }}
        >
          <img src="/logo.png" alt="Committee Management" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <h1 style={{ fontFamily: fonts.display, fontSize: 26, fontWeight: 700, color: T.green, margin: 0, letterSpacing: "-0.01em" }}>
          {t("role.title")}
        </h1>
        <p style={{ color: T.inkSoft, fontSize: 13.5, marginTop: 7, marginBottom: 30, lineHeight: 1.5 }}>
          {t("role.subtitle")}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <RoleCard
            icon={ShieldCheck}
            title={t("role.admin")}
            subtitle={t("role.adminSub")}
            onClick={() => onChoose("admin")}
            delay={40}
          />
          <RoleCard
            icon={UserRound}
            title={t("role.member")}
            subtitle={t("role.memberSub")}
            onClick={() => onChoose("member")}
            delay={100}
          />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // Read once, on mount only (lazy initializer) — a page refresh restores
  // the session instead of dropping the user back to the login screen. See
  // utils/session.js for why this also hands back how much idle-timeout
  // budget was left, rather than letting the timer restart fresh.
  const [restored] = useState(() => loadSession());

  const [entry, setEntry] = useState(null); // null | "admin" | "member"
  const [session, setSessionState] = useState(() => restored?.session || null);
  const [page, setPage] = useState("dashboard");

  const setSession = (next) => {
    setSessionState(next);
    if (next) saveSession(next);
  };

  // Memoized so its identity is stable across App re-renders (e.g. page
  // navigation) — otherwise it flows into Layout's useIdleLogout as a new
  // function every time, which re-triggers that hook's mount effect and
  // silently resets the idle countdown far more often than real user
  // activity would justify.
  const handleLogout = useCallback(() => {
    setSessionState(null);
    setEntry(null);
    setPage("dashboard");
    clearSession();
  }, []);

  const handleCommitteeUpdate = (updatedCommittee) => {
    setSessionState((s) => {
      const next = { ...s, committee: { ...s.committee, ...updatedCommittee } };
      saveSession(next);
      return next;
    });
  };

  if (!session) {
    if (entry === "admin") return <Onboarding onReady={setSession} />;
    if (entry === "member") return <MemberLogin onReady={setSession} onBack={() => setEntry(null)} />;
    return <RoleChoice onChoose={setEntry} />;
  }

  return (
    <Layout session={session} activePage={page} onNavigate={setPage} onLogout={handleLogout} idleResumeMs={restored?.remainingMs}>
      {page === "dashboard" && <Dashboard session={session} />}
      {page === "members" && <Members session={session} />}
      {page === "payments" && <Payments session={session} />}
      {page === "loans" && <Loans session={session} />}
      {page === "settings" && session.role === "admin" && (
        <Settings session={session} onCommitteeUpdate={handleCommitteeUpdate} />
      )}
    </Layout>
  );
}
