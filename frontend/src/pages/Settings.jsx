import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Check, Copy, Building2, ScrollText, Globe, Users, UserMinus, KeyRound, Download, Archive } from "lucide-react";
import { apiRequest } from "../api/client";
import { T, fonts } from "../styles/tokens";
import { Card, Btn, Input, Label, ErrorBanner, Spinner, SectionTitle, LoadingRow, Avatar } from "../components/ui";
import { useI18n } from "../i18n/I18nContext";
import { useToast } from "../components/Toast";
import { useConfirm } from "../components/ConfirmDialog";

export default function Settings({ session, onCommitteeUpdate }) {
  const token = session.adminToken;
  const committeeId = session.committee._id || session.committee.id;
  const isOwner = String(session.committee.owner) === String(session.adminUser?.id);
  const { t, lang, setLang, languages } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState("");
  const [monthlyDefault, setMonthlyDefault] = useState(300);
  const [interestRate, setInterestRate] = useState(0);
  const [rules, setRules] = useState([]);
  const [coAdmins, setCoAdmins] = useState([]);

  // Invite management (owner only)
  const [invites, setInvites] = useState([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [removingCoAdminId, setRemovingCoAdminId] = useState(null);
  const [revokingInviteId, setRevokingInviteId] = useState(null);

  // Backup export
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest(`/committees/${committeeId}`, { token });
      setName(data.committee.name);
      setMonthlyDefault(data.committee.monthlyDefault);
      setInterestRate(data.committee.interestRate || 0);
      setRules(data.committee.rules && data.committee.rules.length ? data.committee.rules : [{ hi: "", en: "" }]);
      setCoAdmins(data.committee.coAdmins || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [committeeId, token]);

  const loadInvites = useCallback(async () => {
    if (!isOwner) return;
    setInvitesLoading(true);
    try {
      const data = await apiRequest(`/committees/${committeeId}/invites`, { token });
      setInvites(data.invites || []);
    } catch {
      setInvites([]);
    } finally {
      setInvitesLoading(false);
    }
  }, [committeeId, token, isOwner]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadInvites(); }, [loadInvites]);

  const updateRule = (i, field, value) => {
    setRules((r) => r.map((rule, idx) => (idx === i ? { ...rule, [field]: value } : rule)));
  };
  const addRule = () => setRules((r) => [...r, { hi: "", en: "" }]);
  const removeRule = (i) => setRules((r) => r.filter((_, idx) => idx !== i));

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      const cleanRules = rules.filter((r) => r.hi.trim() || r.en.trim());
      const data = await apiRequest(`/committees/${committeeId}`, {
        method: "PUT",
        token,
        body: {
          name: name.trim(),
          monthlyDefault: Number(monthlyDefault) || 300,
          interestRate: Math.max(0, Number(interestRate) || 0),
          rules: cleanRules,
        },
      });
      toast.success(t("toast.settingsSaved"));
      onCommitteeUpdate?.(data.committee);
    } catch (e) {
      setError(e.message);
      toast.error(e.message || t("toast.error"));
    } finally {
      setSaving(false);
    }
  };

  const generateInvite = async () => {
    setGeneratingInvite(true);
    try {
      await apiRequest(`/committees/${committeeId}/invites`, { method: "POST", token, body: {} });
      loadInvites();
    } catch (e) {
      toast.error(e.message || t("toast.error"));
    } finally {
      setGeneratingInvite(false);
    }
  };

  const revokeInvite = async (invite) => {
    setRevokingInviteId(invite._id);
    try {
      await apiRequest(`/committees/${committeeId}/invites/${invite._id}`, { method: "DELETE", token });
      loadInvites();
    } catch (e) {
      toast.error(e.message || t("toast.error"));
    } finally {
      setRevokingInviteId(null);
    }
  };

  const removeCoAdmin = async (admin) => {
    const ok = await confirm({
      title: t("settings.removeCoAdmin") + "?",
      body: `${admin.name} — ${t("settings.coAdminsSub")}`,
    });
    if (!ok) return;
    setRemovingCoAdminId(admin._id);
    try {
      await apiRequest(`/committees/${committeeId}/co-admins/${admin._id}`, { method: "DELETE", token });
      setCoAdmins((list) => list.filter((c) => c._id !== admin._id));
      toast.success(t("toast.settingsSaved"));
    } catch (e) {
      toast.error(e.message || t("toast.error"));
    } finally {
      setRemovingCoAdminId(null);
    }
  };

  const downloadBackup = async () => {
    setExporting(true);
    try {
      const data = await apiRequest(`/committees/${committeeId}/export`, { token });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${session.committee.name.replace(/[^a-z0-9]+/gi, "-")}-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e.message || t("toast.error"));
    } finally {
      setExporting(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(session.committee.code);
      setCopied(true);
      toast.success(t("toast.codeCopied"));
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable — silently ignore
    }
  };

  if (loading) {
    return (
      <div>
        <SectionTitle>{t("settings.title")}</SectionTitle>
        <LoadingRow label={t("common.loading")} />
      </div>
    );
  }

  return (
    <div>
      <SectionTitle subtitle={t("settings.subtitle")}>{t("settings.title")}</SectionTitle>
      <ErrorBanner message={error} />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: T.greenTint, color: T.green, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Building2 size={15} />
          </div>
          <p style={{ fontFamily: fonts.display, fontSize: 15.5, fontWeight: 600, color: T.green, margin: 0 }}>
            {t("settings.details")}
          </p>
        </div>
        <div style={{ marginBottom: 14 }}>
          <Label>{t("settings.name")}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 160px" }}>
            <Label>{t("settings.defaultMonthly")}</Label>
            <Input className="ltr-field" type="number" value={monthlyDefault} onChange={(e) => setMonthlyDefault(e.target.value)} />
          </div>
          <div style={{ flex: "1 1 160px" }}>
            <Label>{t("settings.defaultInterestRate")}</Label>
            <Input className="ltr-field" type="number" min="0" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
          </div>
        </div>
        <p style={{ fontSize: 11.5, color: T.inkFaint, margin: "6px 0 0 0" }}>{t("settings.defaultInterestRateSub")}</p>
        <div
          style={{
            marginTop: 14, padding: "12px 14px", background: T.paper, border: `1.5px dashed ${T.gold}`,
            borderRadius: 9, fontSize: 12.5, color: T.inkSoft, display: "flex", alignItems: "center",
            justifyContent: "space-between", flexWrap: "wrap", gap: 8,
          }}
        >
          <span style={{ wordBreak: "break-word" }}>
            {t("settings.joinCode")}: <strong className="ltr-field" style={{ fontFamily: fonts.mono, color: T.green, fontSize: 14, letterSpacing: "0.06em" }}>{session.committee.code}</strong>
          </span>
          <button onClick={copyCode} className="icon-btn" style={{ border: "none", background: "transparent", cursor: "pointer", color: T.green, display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "4px 8px", borderRadius: 6 }}>
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t("settings.copied") : t("settings.copy")}
          </button>
        </div>
        <p style={{ margin: "12px 0 0 0", fontSize: 11.5, color: T.inkFaint }}>
          {t("members.lastLogin")}: {session.adminUser?.lastLogin ? new Date(session.adminUser.lastLogin).toLocaleString() : t("members.neverLoggedIn")}
        </p>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: T.greenTint, color: T.green, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ScrollText size={15} />
          </div>
          <p style={{ fontFamily: fonts.display, fontSize: 15.5, fontWeight: 600, color: T.green, margin: 0 }}>
            {t("settings.rules")}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {rules.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <Input value={r.en} onChange={(e) => updateRule(i, "en", e.target.value)} placeholder={t("settings.ruleEn")} style={{ flex: "1 1 160px" }} />
              <Input value={r.hi} onChange={(e) => updateRule(i, "hi", e.target.value)} placeholder={t("settings.ruleHi")} style={{ flex: "1 1 160px" }} />
              {rules.length > 1 && (
                <button onClick={() => removeRule(i)} className="icon-btn" style={{ border: "none", background: "transparent", color: T.rust, cursor: "pointer", padding: 6, borderRadius: 6 }}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addRule} className="underline-link" style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "none", background: "transparent", color: T.green, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0 }}>
          <Plus size={13} /> {t("settings.addRule")}
        </button>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: T.greenTint, color: T.green, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users size={15} />
          </div>
          <p style={{ fontFamily: fonts.display, fontSize: 15.5, fontWeight: 600, color: T.green, margin: 0 }}>
            {t("settings.coAdmins")}
          </p>
        </div>
        <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "0 0 14px 0" }}>{t("settings.coAdminsSub")}</p>

        {coAdmins.length === 0 ? (
          <p style={{ fontSize: 12.5, color: T.inkFaint, margin: "0 0 16px 0" }}>{t("settings.noCoAdmins")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            {coAdmins.map((c) => (
              <div key={c._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: 8, background: T.paper }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <Avatar name={c.name} size={28} />
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.ink }}>{c.name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: T.inkSoft }}>{c.email}</p>
                  </div>
                </div>
                {isOwner && (
                  <button
                    onClick={() => removeCoAdmin(c)}
                    disabled={removingCoAdminId === c._id}
                    className="icon-btn"
                    style={{ border: "none", background: "transparent", color: T.rust, cursor: "pointer", padding: 6, borderRadius: 6 }}
                    title={t("settings.removeCoAdmin")}
                  >
                    {removingCoAdminId === c._id ? <Spinner color={T.rust} /> : <UserMinus size={15} />}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {!isOwner ? (
          <p style={{ fontSize: 12, color: T.inkFaint, fontStyle: "italic", margin: 0 }}>{t("settings.ownerOnly")}</p>
        ) : (
          <>
            <div style={{ borderTop: `1px dashed ${T.line}`, paddingTop: 14 }}>
              <p style={{ margin: "0 0 4px 0", fontSize: 13, fontWeight: 600, color: T.ink }}>{t("settings.inviteCoAdmin")}</p>
              <p style={{ fontSize: 12, color: T.inkSoft, margin: "0 0 12px 0", lineHeight: 1.5 }}>{t("settings.inviteCoAdminSub")}</p>
              <Btn variant="ghost" onClick={generateInvite} disabled={generatingInvite}>
                {generatingInvite ? <Spinner /> : <KeyRound size={15} />} {t("settings.generateInvite")}
              </Btn>
            </div>

            {!invitesLoading && invites.filter((i) => i.status === "pending").length > 0 && (
              <div style={{ marginTop: 14 }}>
                <p style={{ margin: "0 0 8px 0", fontSize: 12.5, fontWeight: 600, color: T.ink }}>{t("settings.pendingInvites")}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {invites.filter((i) => i.status === "pending").map((inv) => (
                    <div key={inv._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, background: T.goldTint, flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <strong className="ltr-field" style={{ fontFamily: fonts.mono, color: "#8A6416", fontSize: 14, letterSpacing: "0.06em" }}>{inv.code}</strong>
                        <p style={{ margin: "2px 0 0 0", fontSize: 10.5, color: T.inkSoft }}>
                          {t("settings.inviteExpires", { date: new Date(inv.expiresAt).toLocaleDateString() })}
                        </p>
                      </div>
                      <button
                        onClick={() => revokeInvite(inv)}
                        disabled={revokingInviteId === inv._id}
                        className="icon-btn"
                        style={{ border: "none", background: "transparent", color: T.rust, cursor: "pointer", fontSize: 11.5, fontWeight: 600, padding: "4px 8px", borderRadius: 6 }}
                      >
                        {revokingInviteId === inv._id ? <Spinner color={T.rust} /> : t("settings.revokeInvite")}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: T.greenTint, color: T.green, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Archive size={15} />
          </div>
          <p style={{ fontFamily: fonts.display, fontSize: 15.5, fontWeight: 600, color: T.green, margin: 0 }}>
            {t("settings.backup")}
          </p>
        </div>
        <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "0 0 14px 0" }}>{t("settings.backupSub")}</p>
        <Btn variant="ghost" onClick={downloadBackup} disabled={exporting}>
          {exporting ? <Spinner /> : <Download size={15} />} {t("settings.downloadBackup")}
        </Btn>
      </Card>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: T.greenTint, color: T.green, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Globe size={15} />
          </div>
          <div>
            <p style={{ fontFamily: fonts.display, fontSize: 15.5, fontWeight: 600, color: T.green, margin: 0 }}>
              {t("settings.language")}
            </p>
            <p style={{ fontSize: 12, color: T.inkSoft, margin: "2px 0 0 0" }}>{t("settings.languageSub")}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              style={{
                padding: "9px 16px",
                borderRadius: 8,
                border: `1.5px solid ${l.code === lang ? T.green : T.line}`,
                background: l.code === lang ? T.greenTint : T.surface,
                color: l.code === lang ? T.green : T.ink,
                fontSize: 13.5,
                fontWeight: l.code === lang ? 700 : 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {l.code === lang && <Check size={13} />} {l.nativeLabel}
            </button>
          ))}
        </div>
      </Card>

      <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 14 }}>
        <Btn variant="primary" onClick={save} disabled={saving}>
          {saving ? <Spinner /> : <Check size={15} />} {t("settings.saveChanges")}
        </Btn>
      </div>
    </div>
  );
}
