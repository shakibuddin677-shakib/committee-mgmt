import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpen, ShieldCheck, ChevronRight, ChevronLeft, Plus, Trash2,
  Check, Copy, Building2, ArrowRight, KeyRound, Eye, EyeOff,
} from "lucide-react";
import { apiRequest } from "../api/client";
import { T, fonts } from "../styles/tokens";
import { Card, Btn, Input, Label, ErrorBanner, Spinner } from "../components/ui";
import { useI18n, LanguageSwitcher } from "../i18n/I18nContext";

function Stepper({ step }) {
  const { t } = useI18n();
  const steps = [t("onboarding.stepAccount"), t("onboarding.stepCommittee"), t("onboarding.stepReady")];
  return (
    <div className="stepper-row" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 30, width: "100%" }}>
      {steps.map((label, i) => {
        const n = i + 1;
        const active = step === n;
        const done = step > n;
        return (
          <React.Fragment key={label}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <div
                style={{
                  width: 27,
                  height: 27,
                  minWidth: 27,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: fonts.mono,
                  fontSize: 12,
                  fontWeight: 600,
                  background: done ? T.green : active ? T.gold : "transparent",
                  color: done ? T.paper : active ? "#2A2110" : T.inkSoft,
                  border: `1.5px solid ${done ? T.green : active ? T.gold : T.line}`,
                  boxShadow: active ? T.shadowGold : "none",
                  transition: "all 0.25s ease",
                  flexShrink: 0,
                }}
              >
                {done ? <Check size={13} /> : n}
              </div>
              <span className="stepper-label" style={{ fontSize: 12.5, fontWeight: active ? 700 : 500, color: active ? T.green : T.inkSoft, whiteSpace: "nowrap" }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: "1 1 16px", minWidth: 12, maxWidth: 30, height: 1, background: done ? T.gold : T.line, transition: "background 0.25s ease" }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function CreateCommitteeForm({
  cName, setCName, monthlyDefault, setMonthlyDefault,
  rules, updateRule, addRule, removeRule,
  onSubmit, loading, error, firstTime, onBack,
}) {
  const { t } = useI18n();
  return (
    <div>
      <p style={{ fontFamily: fonts.display, fontSize: 16.5, fontWeight: 600, color: T.green, margin: "0 0 4px 0" }}>
        {firstTime ? t("onboarding.firstCommitteeTitle") : t("onboarding.newCommitteeTitle")}
      </p>
      <p style={{ fontSize: 13, color: T.inkSoft, margin: "0 0 20px 0", lineHeight: 1.5 }}>
        {t("onboarding.newCommitteeSub")}
      </p>

      <div style={{ marginBottom: 14 }}>
        <Label>{t("onboarding.committeeName")}</Label>
        <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder={t("onboarding.committeeNamePlaceholder")} />
      </div>
      <div style={{ marginBottom: 20 }}>
        <Label>{t("onboarding.defaultMonthly")}</Label>
        <Input className="ltr-field" type="number" value={monthlyDefault} onChange={(e) => setMonthlyDefault(e.target.value)} placeholder="300" />
      </div>

      <Label>{t("onboarding.rulesOptional")}</Label>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {rules.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Input value={r.en} onChange={(e) => updateRule(i, "en", e.target.value)} placeholder={t("onboarding.rulePlaceholder")} style={{ flex: 1 }} />
            {rules.length > 1 && (
              <button onClick={() => removeRule(i)} className="icon-btn" style={{ border: "none", background: "transparent", color: T.rust, cursor: "pointer", padding: 6, borderRadius: 6 }}>
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={addRule}
        className="underline-link"
        style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "none", background: "transparent", color: T.green, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 4 }}
      >
        <Plus size={13} /> {t("onboarding.addRule")}
      </button>

      <ErrorBanner message={error} />

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        {onBack && (
          <Btn variant="ghost" onClick={onBack}>
            <ChevronLeft size={14} /> {t("onboarding.back")}
          </Btn>
        )}
        <Btn variant="primary" style={{ flex: 1 }} onClick={onSubmit} disabled={loading}>
          {loading ? <Spinner /> : <Check size={15} />} {t("onboarding.createCommittee")}
        </Btn>
      </div>
    </div>
  );
}

export default function Onboarding({ onReady }) {
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [authMode, setAuthMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [adminToken, setAdminToken] = useState("");
  const [adminUser, setAdminUser] = useState(null);

  const [regName, setRegName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [myCommittees, setMyCommittees] = useState(null);
  const [committeeChoice, setCommitteeChoice] = useState("");

  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  const [cName, setCName] = useState("");
  const [monthlyDefault, setMonthlyDefault] = useState(300);
  const [rules, setRules] = useState([{ hi: "", en: "" }]);
  const [createdCommittee, setCreatedCommittee] = useState(null);
  const [copied, setCopied] = useState(false);

  const submitAuth = async () => {
    setError("");
    setLoading(true);
    try {
      let data;
      if (authMode === "register") {
        if (!regName || !email || !password) throw new Error(t("onboarding.fillAllFields"));
        data = await apiRequest("/auth/admin/register", {
          method: "POST",
          body: { name: regName, email, password },
        });
      } else {
        if (!email || !password) throw new Error(t("onboarding.enterCreds"));
        data = await apiRequest("/auth/admin/login", { method: "POST", body: { email, password } });
      }
      setAdminToken(data.token);
      setAdminUser(data.user);
      setStep(2);
    } catch (e) {
      setError(e.message || t("onboarding.genericError"));
    } finally {
      setLoading(false);
    }
  };

  const loadCommittees = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/committees", { token: adminToken });
      setMyCommittees(data.committees || []);
      if (!data.committees || data.committees.length === 0) setCommitteeChoice("new");
    } catch (e) {
      setError(e.message);
      setMyCommittees([]);
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    if (step === 2 && adminToken) loadCommittees();
  }, [step, adminToken, loadCommittees]);

  const updateRule = (i, field, value) => {
    setRules((r) => r.map((rule, idx) => (idx === i ? { ...rule, [field]: value } : rule)));
  };
  const addRule = () => setRules((r) => [...r, { hi: "", en: "" }]);
  const removeRule = (i) => setRules((r) => r.filter((_, idx) => idx !== i));

  const createCommittee = async () => {
    setError("");
    setLoading(true);
    try {
      if (!cName.trim()) throw new Error(t("onboarding.nameRequired"));
      const cleanRules = rules.filter((r) => r.hi.trim() || r.en.trim());
      const data = await apiRequest("/committees", {
        method: "POST",
        token: adminToken,
        body: { name: cName.trim(), monthlyDefault: Number(monthlyDefault) || 300, rules: cleanRules },
      });
      setCreatedCommittee(data.committee);
      setStep(3);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Bug fix: this used to route through the step-3 "your committee is
  // ready — here's your invite code" screen even when picking an existing
  // committee the admin already manages. That screen's copy ("Your
  // committee is ready...") only makes sense right after creating one —
  // showing it every time someone just wants to switch committees was
  // both misleading and an unnecessary extra click. Go straight in.
  const chooseExisting = (committee) => {
    onReady({ role: "admin", adminToken, adminUser, committee });
  };

  const submitJoinInvite = async () => {
    setJoinError("");
    if (!joinCode.trim()) {
      setJoinError(t("onboarding.joinValidation"));
      return;
    }
    setJoining(true);
    try {
      const data = await apiRequest("/committees/invites/redeem", {
        method: "POST",
        token: adminToken,
        body: { code: joinCode.trim().toUpperCase() },
      });
      setJoinCode("");
      setCommitteeChoice("");
      chooseExisting(data.committee);
    } catch (e) {
      setJoinError(e.message);
    } finally {
      setJoining(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(createdCommittee.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable — silently ignore
    }
  };

  return (
    <div
      className="auth-shell"
      style={{
        fontFamily: fonts.body,
        background: `radial-gradient(circle at 15% 8%, ${T.goldTint} 0%, transparent 42%), radial-gradient(circle at 85% 92%, ${T.greenTint} 0%, transparent 45%), ${T.paper}`,
        minHeight: "100vh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 20px",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", top: 16, insetInlineEnd: 16 }}>
        <LanguageSwitcher tone="dark" align="right" />
      </div>
      <div className="fade-up" style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              overflow: "hidden",
              margin: "0 auto 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: T.surface,
              boxShadow: T.shadowGreen,
            }}
          >
            <img src="/logo.png" alt="Committee Management" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <h1 style={{ fontFamily: fonts.display, fontSize: 23, fontWeight: 700, color: T.green, margin: 0, letterSpacing: "-0.01em" }}>
            {t("onboarding.title")}
          </h1>
          <p style={{ color: T.inkSoft, fontSize: 13.5, marginTop: 5 }}>{t("onboarding.subtitle")}</p>
        </div>

        <Stepper step={step} />

        {step === 1 && (
          <Card style={{ boxShadow: T.shadowMd }} className="pop-in">
            <div style={{ display: "flex", gap: 8, marginBottom: 20, background: T.paper2, padding: 4, borderRadius: 9 }}>
              <button
                onClick={() => { setAuthMode("login"); setError(""); }}
                className="btn-lift"
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 6, cursor: "pointer",
                  border: "none",
                  background: authMode === "login" ? T.surface : "transparent",
                  boxShadow: authMode === "login" ? T.shadowSm : "none",
                  color: authMode === "login" ? T.green : T.inkSoft, fontWeight: 600, fontSize: 13.5,
                }}
              >
                {t("onboarding.login")}
              </button>
              <button
                onClick={() => { setAuthMode("register"); setError(""); }}
                className="btn-lift"
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 6, cursor: "pointer",
                  border: "none",
                  background: authMode === "register" ? T.surface : "transparent",
                  boxShadow: authMode === "register" ? T.shadowSm : "none",
                  color: authMode === "register" ? T.green : T.inkSoft, fontWeight: 600, fontSize: 13.5,
                }}
              >
                {t("onboarding.register")}
              </button>
            </div>

            {authMode === "register" && (
              <div style={{ marginBottom: 14 }}>
                <Label>{t("onboarding.yourName")}</Label>
                <Input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="e.g. Azeem Ansari" />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <Label>{t("onboarding.email")}</Label>
              <Input className="ltr-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div style={{ marginBottom: 4 }}>
              <Label>{t("onboarding.password")}</Label>
              <div style={{ position: "relative" }}>
                <Input
                  className="ltr-field"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  onKeyDown={(e) => e.key === "Enter" && submitAuth()}
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    padding: 4,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    color: T.inkFaint,
                  }}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <ErrorBanner message={error} />

            <Btn variant="primary" style={{ width: "100%", marginTop: 20 }} onClick={submitAuth} disabled={loading}>
              {loading ? <Spinner /> : <ShieldCheck size={15} />}
              {authMode === "register" ? t("onboarding.createAccount") : t("onboarding.login")}
            </Btn>
          </Card>
        )}

        {step === 2 && (
          <Card style={{ boxShadow: T.shadowMd }} className="pop-in">
            {myCommittees === null ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.inkSoft, fontSize: 13.5, padding: "10px 0" }}>
                <Spinner /> {t("onboarding.loadingCommittees")}
              </div>
            ) : committeeChoice === "new" && myCommittees.length === 0 ? (
              <CreateCommitteeForm
                cName={cName} setCName={setCName}
                monthlyDefault={monthlyDefault} setMonthlyDefault={setMonthlyDefault}
                rules={rules} updateRule={updateRule} addRule={addRule} removeRule={removeRule}
                onSubmit={createCommittee} loading={loading} error={error}
                firstTime
              />
            ) : committeeChoice === "new" ? (
              <CreateCommitteeForm
                cName={cName} setCName={setCName}
                monthlyDefault={monthlyDefault} setMonthlyDefault={setMonthlyDefault}
                rules={rules} updateRule={updateRule} addRule={addRule} removeRule={removeRule}
                onSubmit={createCommittee} loading={loading} error={error}
                onBack={() => setCommitteeChoice("")}
              />
            ) : committeeChoice === "join" ? (
              <div>
                <p style={{ fontFamily: fonts.display, fontSize: 16.5, fontWeight: 600, color: T.green, margin: "0 0 4px 0" }}>
                  {t("onboarding.joinTitle")}
                </p>
                <p style={{ fontSize: 13, color: T.inkSoft, margin: "0 0 20px 0", lineHeight: 1.5 }}>
                  {t("onboarding.joinSub")}
                </p>
                <div style={{ marginBottom: 16 }}>
                  <Label>{t("onboarding.inviteCode")}</Label>
                  <Input
                    className="ltr-field"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. K7M2P9QX"
                    style={{ fontFamily: fonts.mono, letterSpacing: "0.05em" }}
                    onKeyDown={(e) => e.key === "Enter" && submitJoinInvite()}
                  />
                </div>
                <ErrorBanner message={joinError} />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <Btn variant="ghost" onClick={() => { setCommitteeChoice(""); setJoinError(""); }}>{t("onboarding.back")}</Btn>
                  <Btn variant="primary" style={{ flex: 1 }} onClick={submitJoinInvite} disabled={joining}>
                    {joining ? <Spinner /> : <KeyRound size={15} />} {t("onboarding.joinSubmit")}
                  </Btn>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontFamily: fonts.display, fontSize: 16.5, fontWeight: 600, color: T.green, margin: "0 0 4px 0" }}>
                  {t("onboarding.welcome", { name: adminUser?.name })}
                </p>
                <p style={{ fontSize: 13, color: T.inkSoft, margin: "0 0 20px 0" }}>
                  {t("onboarding.manageCount", { count: myCommittees.length, plural: myCommittees.length === 1 ? "" : "s" })}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                  {myCommittees.map((c) => (
                    <button
                      key={c._id}
                      onClick={() => chooseExisting(c)}
                      className="card-hover btn-lift"
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left",
                        padding: "13px 15px", borderRadius: 9, border: `1px solid ${T.line}`, background: T.paper,
                        cursor: "pointer", width: "100%", boxSizing: "border-box",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, flex: 1 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: T.greenTint, color: T.green, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Building2 size={16} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</p>
                          <p className="ltr-field" style={{ margin: 0, fontSize: 11.5, color: T.inkSoft, fontFamily: fonts.mono, textAlign: "left" }}>
                            {t("onboarding.codeLabel")}: {c.code}
                          </p>
                        </div>
                      </div>
                      <ArrowRight size={15} color={T.inkFaint} style={{ flexShrink: 0, marginLeft: 8 }} />
                    </button>
                  ))}
                </div>

                <Btn variant="gold" style={{ width: "100%" }} onClick={() => setCommitteeChoice("new")}>
                  <Plus size={15} /> {t("onboarding.createNew")}
                </Btn>
                <button
                  onClick={() => setCommitteeChoice("join")}
                  className="underline-link"
                  style={{ display: "block", width: "100%", textAlign: "center", border: "none", background: "transparent", color: T.green, fontSize: 12.5, fontWeight: 600, cursor: "pointer", marginTop: 14, padding: 0 }}
                >
                  {t("onboarding.joinWithCode")}
                </button>
                <ErrorBanner message={error} />
              </div>
            )}
          </Card>
        )}

        {step === 3 && createdCommittee && (
          <Card style={{ textAlign: "center", boxShadow: T.shadowMd }} className="pop-in">
            <div
              style={{
                width: 50, height: 50, borderRadius: "50%",
                background: `linear-gradient(155deg, ${T.greenSoft}, ${T.greenDeep})`,
                color: T.paper,
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
                boxShadow: T.shadowGreen,
              }}
            >
              <Check size={22} />
            </div>
            <p style={{ fontFamily: fonts.display, fontSize: 19, fontWeight: 700, color: T.green, margin: "0 0 4px 0" }}>
              {createdCommittee.name}
            </p>
            <p style={{ fontSize: 13, color: T.inkSoft, margin: "0 0 22px 0" }}>
              {t("onboarding.ready")}
            </p>

            <div
              style={{
                background: T.paper, border: `1.5px dashed ${T.gold}`, borderRadius: 11, padding: "15px 18px",
                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 22,
              }}
            >
              <span className="ltr-field" style={{ fontFamily: fonts.mono, fontSize: 22, fontWeight: 700, letterSpacing: "0.12em", color: T.green, wordBreak: "break-word" }}>
                {createdCommittee.code}
              </span>
              <button
                onClick={copyCode}
                className="icon-btn"
                style={{ border: "none", background: "transparent", cursor: "pointer", color: T.green, display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, padding: "5px 9px", borderRadius: 7 }}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? t("onboarding.copied") : t("onboarding.copy")}
              </button>
            </div>

            <Btn
              variant="primary"
              style={{ width: "100%" }}
              onClick={() => onReady({ role: "admin", adminToken, adminUser, committee: createdCommittee })}
            >
              {t("onboarding.goToDashboard")} <ChevronRight size={15} />
            </Btn>

            <button
              onClick={() => { setCreatedCommittee(null); setCommitteeChoice(""); setMyCommittees(null); setStep(2); }}
              className="underline-link"
              style={{ border: "none", background: "transparent", color: T.inkSoft, fontSize: 12, marginTop: 16, cursor: "pointer" }}
            >
              <ChevronLeft size={12} style={{ verticalAlign: -1 }} /> {t("onboarding.backToCommittees")}
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}
