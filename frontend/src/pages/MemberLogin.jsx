import React, { useState } from "react";
import { UserRound, ChevronLeft, KeyRound, MailCheck } from "lucide-react";
import { apiRequest } from "../api/client";
import { T, fonts } from "../styles/tokens";
import { Card, Btn, Input, Label, ErrorBanner, Spinner } from "../components/ui";
import { useI18n, LanguageSwitcher } from "../i18n/I18nContext";

export default function MemberLogin({ onReady, onBack }) {
  const [committeeCode, setCommitteeCode] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useI18n();

  // "Forgot PIN" mini-flow, shown in place of the login card
  const [mode, setMode] = useState("login"); // "login" | "forgotPin" | "requestSent"
  const [resetCode, setResetCode] = useState("");
  const [resetPhone, setResetPhone] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");

  const submit = async () => {
    setError("");
    if (!committeeCode.trim() || !phone.trim() || pin.length !== 4) {
      setError(t("login.validation"));
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest("/auth/member/login", {
        method: "POST",
        body: { committeeCode: committeeCode.trim().toUpperCase(), phone: phone.trim(), pin },
      });
      onReady({
        role: "member",
        memberToken: data.token,
        memberUser: data.user,
        committee: data.committee,
      });
    } catch (e) {
      setError(e.message || t("login.failed"));
    } finally {
      setLoading(false);
    }
  };

  const submitPinResetRequest = async () => {
    setResetError("");
    if (!resetCode.trim() || !resetPhone.trim()) {
      setResetError(t("login.pinRequestValidation"));
      return;
    }
    setResetLoading(true);
    try {
      // Resolve the code to a committee id first — the reset-request
      // endpoint needs :committeeId in the URL, and this also confirms
      // the code is real before we bother the server with the phone.
      const lookup = await apiRequest(`/committees/lookup/${resetCode.trim().toUpperCase()}`);
      const committeeId = lookup.committee._id || lookup.committee.id;
      await apiRequest(`/committees/${committeeId}/pin-reset-request`, {
        method: "POST",
        body: { phone: resetPhone.trim() },
      });
      setMode("requestSent");
    } catch (e) {
      setResetError(e.message || t("toast.error"));
    } finally {
      setResetLoading(false);
    }
  };

  const resetToLogin = () => {
    setMode("login");
    setResetCode("");
    setResetPhone("");
    setResetError("");
  };

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
      <div className="fade-up" style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div
            style={{
              width: 58, height: 58, borderRadius: "50%",
              background: `linear-gradient(155deg, ${T.greenSoft}, ${T.greenDeep})`,
              margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center",
              color: T.paper, boxShadow: T.shadowGreen,
            }}
          >
            {mode === "requestSent" ? <MailCheck size={24} /> : mode === "forgotPin" ? <KeyRound size={24} /> : <UserRound size={24} />}
          </div>
          <h1 style={{ fontFamily: fonts.display, fontSize: 23, fontWeight: 700, color: T.green, margin: 0, letterSpacing: "-0.01em" }}>
            {mode === "requestSent" ? t("login.pinRequestSentTitle") : mode === "forgotPin" ? t("login.forgotPinTitle") : t("login.memberTitle")}
          </h1>
        </div>

        {mode === "login" && (
          <Card style={{ boxShadow: T.shadowMd }}>
            <div style={{ marginBottom: 14 }}>
              <Label>{t("login.committeeCode")}</Label>
              <Input
                className="ltr-field"
                value={committeeCode}
                onChange={(e) => setCommitteeCode(e.target.value.toUpperCase())}
                placeholder="e.g. AZAD01"
                style={{ fontFamily: fonts.mono, letterSpacing: "0.05em" }}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <Label>{t("members.phone")}</Label>
              <Input className="ltr-field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("members.phone")} />
            </div>
            <div style={{ marginBottom: 4 }}>
              <Label>{t("login.pin")}</Label>
              <Input
                className="ltr-field"
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>

            <ErrorBanner message={error} />

            <Btn variant="primary" style={{ width: "100%", marginTop: 18 }} onClick={submit} disabled={loading}>
              {loading ? <Spinner /> : <UserRound size={15} />} {t("login.submit")}
            </Btn>

            <button
              onClick={() => setMode("forgotPin")}
              className="underline-link"
              style={{ display: "block", width: "100%", textAlign: "center", border: "none", background: "transparent", color: T.green, fontSize: 12.5, fontWeight: 600, cursor: "pointer", marginTop: 16, padding: 0 }}
            >
              {t("login.forgotPin")}
            </button>
          </Card>
        )}

        {mode === "forgotPin" && (
          <Card style={{ boxShadow: T.shadowMd }} className="pop-in">
            <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "0 0 16px 0", lineHeight: 1.5 }}>{t("login.forgotPinSub")}</p>
            <div style={{ marginBottom: 14 }}>
              <Label>{t("login.committeeCode")}</Label>
              <Input
                className="ltr-field"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.toUpperCase())}
                placeholder="e.g. AZAD01"
                style={{ fontFamily: fonts.mono, letterSpacing: "0.05em" }}
              />
            </div>
            <div style={{ marginBottom: 4 }}>
              <Label>{t("members.phone")}</Label>
              <Input
                className="ltr-field"
                value={resetPhone}
                onChange={(e) => setResetPhone(e.target.value)}
                placeholder={t("members.phone")}
                onKeyDown={(e) => e.key === "Enter" && submitPinResetRequest()}
              />
            </div>

            <ErrorBanner message={resetError} />

            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <Btn variant="ghost" onClick={resetToLogin}>{t("common.cancel")}</Btn>
              <Btn variant="primary" style={{ flex: 1 }} onClick={submitPinResetRequest} disabled={resetLoading}>
                {resetLoading ? <Spinner /> : <KeyRound size={15} />} {t("login.submitPinRequest")}
              </Btn>
            </div>
          </Card>
        )}

        {mode === "requestSent" && (
          <Card style={{ boxShadow: T.shadowMd, textAlign: "center" }} className="pop-in">
            <p style={{ fontSize: 13.5, color: T.inkSoft, margin: "0 0 18px 0", lineHeight: 1.6 }}>{t("login.pinRequestSentSub")}</p>
            <Btn variant="primary" style={{ width: "100%" }} onClick={resetToLogin}>
              {t("login.backToLogin")}
            </Btn>
          </Card>
        )}

        <button
          onClick={onBack}
          className="underline-link"
          style={{ display: "flex", alignItems: "center", gap: 5, border: "none", background: "transparent", color: T.inkSoft, fontSize: 12.5, cursor: "pointer", margin: "18px auto 0", padding: 0 }}
        >
          <ChevronLeft size={13} /> {t("login.back")}
        </button>
      </div>
    </div>
  );
}
