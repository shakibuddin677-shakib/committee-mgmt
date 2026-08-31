import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2, Check, X, Phone, Wallet, UserPlus, Search, Download, KeyRound, ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { apiRequest } from "../api/client";
import { T, fonts } from "../styles/tokens";
import { Card, Btn, Input, Label, ErrorBanner, Spinner, SectionTitle, Avatar, EmptyState, Skeleton } from "../components/ui";
import { useI18n } from "../i18n/I18nContext";
import { useToast } from "../components/Toast";
import { useConfirm } from "../components/ConfirmDialog";
import { downloadCsv } from "../utils/csv";
import StatementModal from "../components/StatementModal";

const PAGE_SIZE = 12;

export default function Members({ session }) {
  const isAdmin = session.role === "admin";
  const token = isAdmin ? session.adminToken : session.memberToken;
  const committeeId = session.committee._id || session.committee.id;
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [members, setMembers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", pin: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  // Member self-service: edit own phone
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

  // Member self-service: change own PIN
  const [pinForm, setPinForm] = useState({ currentPin: "", newPin: "", confirmPin: "" });
  const [pinSaving, setPinSaving] = useState(false);
  const [pinError, setPinError] = useState("");

  // Admin: pending PIN reset requests
  const [pinRequests, setPinRequests] = useState([]);
  const [pinRequestsLoading, setPinRequestsLoading] = useState(true);
  const [approvingReqId, setApprovingReqId] = useState(null);
  const [approvePinDraft, setApprovePinDraft] = useState("");
  const [approveReqSaving, setApproveReqSaving] = useState(false);
  const [rejectingReqId, setRejectingReqId] = useState(null);

  // Member self-service: print full-year statement
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementData, setStatementData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (isAdmin) {
        const data = await apiRequest(`/committees/${committeeId}/members`, { token });
        setMembers(data.members || []);
      } else {
        const data = await apiRequest(`/committees/${committeeId}/members/${session.memberUser.id}`, { token });
        setMembers([data.member]);
        setPhoneDraft(data.member.phone || "");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [committeeId, token, isAdmin, session.memberUser]);

  const loadPinRequests = useCallback(async () => {
    if (!isAdmin) return;
    setPinRequestsLoading(true);
    try {
      const data = await apiRequest(`/committees/${committeeId}/pin-reset-requests?status=pending`, { token });
      setPinRequests(data.requests || []);
    } catch {
      setPinRequests([]);
    } finally {
      setPinRequestsLoading(false);
    }
  }, [committeeId, token, isAdmin]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadPinRequests(); }, [loadPinRequests]);

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.name?.toLowerCase().includes(q) || m.phone?.toLowerCase().includes(q));
  }, [members, query]);

  // Reset to page 1 whenever the search query (or the underlying list) changes
  useEffect(() => { setPage(1); }, [query, members.length]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pagedMembers = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filteredMembers.slice(start, start + PAGE_SIZE);
  }, [filteredMembers, pageSafe]);

  const addMember = async () => {
    setError("");
    if (!form.name.trim() || !form.phone.trim() || form.pin.length !== 4) {
      setError(t("members.validation"));
      return;
    }
    setSaving(true);
    try {
      await apiRequest(`/committees/${committeeId}/members`, {
        method: "POST",
        token,
        body: { name: form.name.trim(), phone: form.phone.trim(), pin: form.pin },
      });
      setForm({ name: "", phone: "", pin: "" });
      setShowAddForm(false);
      toast.success(t("toast.memberAdded"));
      load();
    } catch (e) {
      setError(e.message);
      toast.error(e.message || t("toast.error"));
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    setError("");
    setSaving(true);
    try {
      await apiRequest(`/committees/${committeeId}/members/${editing._id}`, {
        method: "PUT",
        token,
        body: { name: editing.name, phone: editing.phone, monthlyAmount: Number(editing.monthlyAmount) },
      });
      setEditing(null);
      toast.success(t("toast.memberUpdated"));
      load();
    } catch (e) {
      setError(e.message);
      toast.error(e.message || t("toast.error"));
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (member) => {
    const ok = await confirm({
      title: t("confirm.deleteMemberTitle"),
      body: t("confirm.deleteMemberBody", { name: member.name }),
    });
    if (!ok) return;

    setError("");
    setDeletingId(member._id);
    try {
      await apiRequest(`/committees/${committeeId}/members/${member._id}`, { method: "DELETE", token });
      toast.success(t("toast.memberDeleted"));
      load();
    } catch (e) {
      setError(e.message);
      toast.error(e.message || t("toast.error"));
    } finally {
      setDeletingId(null);
    }
  };

  const changeMyPin = async () => {
    setPinError("");
    if (!pinForm.currentPin || pinForm.newPin.length !== 4 || pinForm.confirmPin.length !== 4) {
      setPinError(t("members.pinValidation"));
      return;
    }
    if (pinForm.newPin !== pinForm.confirmPin) {
      setPinError(t("members.pinMismatch"));
      return;
    }
    setPinSaving(true);
    try {
      await apiRequest(`/committees/${committeeId}/members/me/pin`, {
        method: "PUT",
        token,
        body: { currentPin: pinForm.currentPin, newPin: pinForm.newPin },
      });
      setPinForm({ currentPin: "", newPin: "", confirmPin: "" });
      toast.success(t("toast.pinChanged"));
    } catch (e) {
      setPinError(e.message);
      toast.error(e.message || t("toast.error"));
    } finally {
      setPinSaving(false);
    }
  };

  const saveMyPhone = async () => {
    setError("");
    if (!phoneDraft.trim()) {
      setError(t("members.validation"));
      return;
    }
    setSavingPhone(true);
    try {
      await apiRequest(`/committees/${committeeId}/members/me/profile`, {
        method: "PUT",
        token,
        body: { phone: phoneDraft.trim() },
      });
      setEditingPhone(false);
      toast.success(t("toast.phoneUpdated"));
      load();
    } catch (e) {
      setError(e.message);
      toast.error(e.message || t("toast.error"));
    } finally {
      setSavingPhone(false);
    }
  };

  const openApprovePinRequest = (req) => {
    setApprovingReqId(req._id);
    setApprovePinDraft("");
  };

  const submitApprovePinRequest = async (req) => {
    setError("");
    if (approvePinDraft.length !== 4) {
      setError(t("members.pinValidation"));
      return;
    }
    setApproveReqSaving(true);
    try {
      await apiRequest(`/committees/${committeeId}/pin-reset-requests/${req._id}/approve`, {
        method: "PUT",
        token,
        body: { newPin: approvePinDraft },
      });
      setApprovingReqId(null);
      toast.success(t("toast.pinRequestApproved"));
      loadPinRequests();
    } catch (e) {
      setError(e.message);
      toast.error(e.message || t("toast.error"));
    } finally {
      setApproveReqSaving(false);
    }
  };

  const rejectPinRequest = async (req) => {
    const ok = await confirm({
      title: t("confirm.rejectPinTitle"),
      body: t("confirm.rejectPinBody"),
    });
    if (!ok) return;

    setRejectingReqId(req._id);
    try {
      await apiRequest(`/committees/${committeeId}/pin-reset-requests/${req._id}/reject`, { method: "PUT", token, body: {} });
      toast.success(t("toast.pinRequestRejected"));
      loadPinRequests();
    } catch (e) {
      toast.error(e.message || t("toast.error"));
    } finally {
      setRejectingReqId(null);
    }
  };

  const exportCsv = () => {
    downloadCsv(
      `${session.committee.name}-members`,
      [
        { label: t("members.fullName"), get: (m) => m.name },
        { label: t("members.phone"), get: (m) => m.phone },
        { label: t("members.monthlyAmount"), get: (m) => m.monthlyAmount },
      ],
      filteredMembers
    );
  };

  const openStatement = async () => {
    setStatementLoading(true);
    setError("");
    try {
      const year = new Date().getFullYear();
      const [paymentsData, loansData] = await Promise.all([
        apiRequest(`/committees/${committeeId}/payments/member/${session.memberUser.id}?year=${year}`, { token }),
        apiRequest(`/committees/${committeeId}/loans/member/${session.memberUser.id}`, { token }),
      ]);
      setStatementData({ year, payments: paymentsData.payments || [], loans: loansData.loans || [] });
      setStatementOpen(true);
    } catch (e) {
      setError(e.message);
      toast.error(e.message || t("toast.error"));
    } finally {
      setStatementLoading(false);
    }
  };

  return (
    <div>
      <SectionTitle
        subtitle={isAdmin ? t("members.subtitleCount", { count: members.length, plural: members.length === 1 ? "" : "s" }) : undefined}
        action={
          isAdmin && !showAddForm ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {members.length > 0 && (
                <Btn variant="ghost" onClick={exportCsv}>
                  <Download size={15} /> {t("members.exportCsv")}
                </Btn>
              )}
              <Btn variant="primary" onClick={() => setShowAddForm(true)}>
                <Plus size={15} /> {t("members.addMember")}
              </Btn>
            </div>
          ) : !isAdmin && members.length > 0 ? (
            <Btn variant="ghost" onClick={openStatement} disabled={statementLoading}>
              {statementLoading ? <Spinner /> : <Printer size={15} />} {t("members.printStatement")}
            </Btn>
          ) : undefined
        }
      >
        {isAdmin ? t("members.titleAdmin") : t("members.titleMember")}
      </SectionTitle>

      <ErrorBanner message={error} />

      {isAdmin && showAddForm && (
        <Card style={{ marginBottom: 18, borderColor: T.gold }} className="pop-in">
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: T.goldTint, color: "#8A6416", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UserPlus size={15} />
            </div>
            <p style={{ fontFamily: fonts.display, fontSize: 15.5, fontWeight: 600, color: T.green, margin: 0 }}>
              {t("members.newMember")}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Input placeholder={t("members.fullName")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ flex: 2, minWidth: 150 }} />
            <Input placeholder={t("members.phone")} className="ltr-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ flex: 1, minWidth: 130 }} />
            <Input placeholder={t("members.pin")} className="ltr-field" maxLength={4} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })} style={{ width: 110 }} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Btn variant="ghost" onClick={() => { setShowAddForm(false); setForm({ name: "", phone: "", pin: "" }); setError(""); }}>{t("common.cancel")}</Btn>
            <Btn variant="primary" onClick={addMember} disabled={saving}>
              {saving ? <Spinner /> : <Check size={15} />} {t("members.saveMember")}
            </Btn>
          </div>
        </Card>
      )}

      {/* Admin: pending PIN reset requests */}
      {isAdmin && (!pinRequestsLoading && pinRequests.length > 0) && (
        <Card style={{ marginBottom: 18, borderColor: T.gold }} className="fade-up">
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: T.goldTint, color: "#8A6416", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <KeyRound size={15} />
            </div>
            <p style={{ fontFamily: fonts.display, fontSize: 15.5, fontWeight: 600, color: T.green, margin: 0 }}>
              {t("members.pendingPinRequests")}
            </p>
          </div>
          <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "0 0 14px 0" }}>
            {t("members.pinRequestsSubtitle", { count: pinRequests.length, plural: pinRequests.length === 1 ? "" : "s" })}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pinRequests.map((req) => (
              <div key={req._id} style={{ borderTop: `1px dashed ${T.line}`, paddingTop: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={req.member?.name || "?"} size={32} tone="gold" />
                    <div>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: T.ink }}>{req.member?.name}</p>
                      <p className="ltr-field" style={{ margin: 0, fontSize: 11.5, color: T.inkSoft }}>{req.member?.phone}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      onClick={() => openApprovePinRequest(req)}
                      className="icon-btn"
                      style={{ border: "none", background: "transparent", color: T.green, cursor: "pointer", padding: 6, borderRadius: 6 }}
                      title={t("members.setNewPin")}
                    >
                      <ThumbsUp size={16} />
                    </button>
                    <button
                      onClick={() => rejectPinRequest(req)}
                      disabled={rejectingReqId === req._id}
                      className="icon-btn"
                      style={{ border: "none", background: "transparent", color: T.rust, cursor: "pointer", padding: 6, borderRadius: 6 }}
                      title={t("members.rejectRequest")}
                    >
                      {rejectingReqId === req._id ? <Spinner color={T.rust} /> : <ThumbsDown size={16} />}
                    </button>
                  </div>
                </div>

                {approvingReqId === req._id && (
                  <div className="pop-in" style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                    <p style={{ margin: 0, fontSize: 12, color: T.inkSoft }}>{t("members.setNewPinSub")}</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Input
                        className="ltr-field"
                        maxLength={4}
                        value={approvePinDraft}
                        onChange={(e) => setApprovePinDraft(e.target.value.replace(/\D/g, ""))}
                        placeholder={t("members.newPin")}
                        style={{ width: 110 }}
                      />
                      <Btn variant="ghost" onClick={() => setApprovingReqId(null)}>{t("common.cancel")}</Btn>
                      <Btn variant="primary" onClick={() => submitApprovePinRequest(req)} disabled={approveReqSaving}>
                        {approveReqSaving ? <Spinner /> : <Check size={15} />} {t("members.confirmSetPin")}
                      </Btn>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Member: profile info — last login + edit own phone */}
      {!isAdmin && members.length > 0 && (
        <Card style={{ marginBottom: 18 }} className="fade-up">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: T.greenTint, color: T.green, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Phone size={15} />
              </div>
              {editingPhone ? (
                <Input className="ltr-field" value={phoneDraft} onChange={(e) => setPhoneDraft(e.target.value)} style={{ maxWidth: 200 }} />
              ) : (
                <span className="ltr-field" style={{ fontSize: 14, color: T.ink, fontWeight: 600 }}>{members[0].phone}</span>
              )}
            </div>
            {editingPhone ? (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <Btn variant="ghost" onClick={() => { setEditingPhone(false); setPhoneDraft(members[0].phone); setError(""); }}>{t("common.cancel")}</Btn>
                <Btn variant="primary" onClick={saveMyPhone} disabled={savingPhone}>
                  {savingPhone ? <Spinner /> : <Check size={15} />} {t("members.savePhone")}
                </Btn>
              </div>
            ) : (
              <Btn variant="ghost" size="sm" onClick={() => setEditingPhone(true)}><Pencil size={13} /> {t("members.editPhone")}</Btn>
            )}
          </div>
          <p style={{ margin: "12px 0 0 0", fontSize: 11.5, color: T.inkFaint }}>
            {t("members.lastLogin")}: {members[0].lastLogin ? new Date(members[0].lastLogin).toLocaleString() : t("members.neverLoggedIn")}
          </p>
        </Card>
      )}

      {/* Member: change own PIN */}
      {!isAdmin && members.length > 0 && (
        <Card style={{ marginBottom: 18 }} className="fade-up">
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: T.greenTint, color: T.green, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <KeyRound size={15} />
            </div>
            <p style={{ fontFamily: fonts.display, fontSize: 15.5, fontWeight: 600, color: T.green, margin: 0 }}>
              {t("members.changePin")}
            </p>
          </div>
          <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "0 0 14px 0" }}>{t("members.changePinSub")}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 110px" }}>
              <Label>{t("members.currentPin")}</Label>
              <Input className="ltr-field" type="password" maxLength={4} value={pinForm.currentPin} onChange={(e) => setPinForm({ ...pinForm, currentPin: e.target.value.replace(/\D/g, "") })} placeholder="••••" />
            </div>
            <div style={{ flex: "1 1 110px" }}>
              <Label>{t("members.newPin")}</Label>
              <Input className="ltr-field" type="password" maxLength={4} value={pinForm.newPin} onChange={(e) => setPinForm({ ...pinForm, newPin: e.target.value.replace(/\D/g, "") })} placeholder="••••" />
            </div>
            <div style={{ flex: "1 1 110px" }}>
              <Label>{t("members.confirmPin")}</Label>
              <Input className="ltr-field" type="password" maxLength={4} value={pinForm.confirmPin} onChange={(e) => setPinForm({ ...pinForm, confirmPin: e.target.value.replace(/\D/g, "") })} placeholder="••••" />
            </div>
          </div>
          <ErrorBanner message={pinError} />
          <Btn variant="primary" onClick={changeMyPin} disabled={pinSaving} style={{ marginTop: 12 }}>
            {pinSaving ? <Spinner /> : <KeyRound size={15} />} {t("members.savePin")}
          </Btn>
        </Card>
      )}

      {isAdmin && !loading && members.length > 0 && (
        <div style={{ position: "relative", marginBottom: 14, maxWidth: 340 }}>
          <Search size={15} color={T.inkFaint} style={{ position: "absolute", insetInlineStart: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("common.searchPlaceholder")}
            style={{ paddingInlineStart: 36 }}
          />
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
              <Skeleton width={36} height={36} style={{ borderRadius: "50%" }} />
              <div style={{ flex: 1 }}>
                <Skeleton width={140} height={12} />
                <Skeleton width={100} height={10} style={{ marginTop: 8 }} />
              </div>
            </Card>
          ))}
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title={t("members.empty")}
          subtitle={isAdmin ? t("members.emptySubAdmin") : t("members.emptySubMember")}
          action={isAdmin && !showAddForm ? (
            <Btn variant="primary" onClick={() => setShowAddForm(true)}><Plus size={15} /> {t("members.addMember")}</Btn>
          ) : undefined}
        />
      ) : filteredMembers.length === 0 ? (
        <EmptyState icon={Search} title={t("members.noMatch", { query })} />
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pagedMembers.map((m, idx) => (
              <Card key={m._id} hover className="fade-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, padding: "13px 18px", animationDelay: `${idx * 30}ms` }}>
                {editing?._id === m._id ? (
                  <div style={{ display: "flex", gap: 8, flex: 1, alignItems: "center", flexWrap: "wrap" }}>
                    <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} style={{ flex: "1 1 120px", minWidth: 120 }} />
                    <Input className="ltr-field" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} style={{ flex: "1 1 120px", minWidth: 120 }} />
                    <Input className="ltr-field" type="number" value={editing.monthlyAmount} onChange={(e) => setEditing({ ...editing, monthlyAmount: e.target.value })} style={{ width: 100 }} />
                    <button onClick={saveEdit} disabled={saving} className="icon-btn" style={{ border: "none", background: "transparent", color: T.green, cursor: "pointer", padding: 6, borderRadius: 6 }}>
                      {saving ? <Spinner /> : <Check size={17} />}
                    </button>
                    <button onClick={() => setEditing(null)} className="icon-btn" style={{ border: "none", background: "transparent", color: T.rust, cursor: "pointer", padding: 6, borderRadius: 6 }}><X size={17} /></button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0, flex: "1 1 200px" }}>
                      <Avatar name={m.name} size={38} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 600, color: T.ink, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</p>
                        <p style={{ margin: "2px 0 0 0", fontSize: 12, color: T.inkSoft, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span className="ltr-field" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Phone size={11} /> {m.phone}</span>
                          <span className="ltr-field" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Wallet size={11} /> ₹{m.monthlyAmount}{t("members.perMonth")}</span>
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                        <button onClick={() => setEditing(m)} className="icon-btn" style={{ border: "none", background: "transparent", color: T.inkSoft, cursor: "pointer", padding: 7, borderRadius: 6 }}><Pencil size={16} /></button>
                        <button
                          onClick={() => removeMember(m)}
                          disabled={deletingId === m._id}
                          className="icon-btn"
                          style={{ border: "none", background: "transparent", color: T.rust, cursor: "pointer", padding: 7, borderRadius: 6 }}
                        >
                          {deletingId === m._id ? <Spinner color={T.rust} /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, flexWrap: "wrap", gap: 10 }}>
              <span style={{ fontSize: 12, color: T.inkSoft }}>
                {t("members.showingCount", {
                  from: (pageSafe - 1) * PAGE_SIZE + 1,
                  to: Math.min(pageSafe * PAGE_SIZE, filteredMembers.length),
                  total: filteredMembers.length,
                })}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageSafe <= 1} className="icon-btn" style={pageBtnStyle(pageSafe <= 1)}>
                  <ChevronLeft size={15} />
                </button>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, minWidth: 90, textAlign: "center" }}>
                  {t("members.page", { page: pageSafe, pages: totalPages })}
                </span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={pageSafe >= totalPages} className="icon-btn" style={pageBtnStyle(pageSafe >= totalPages)}>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {statementOpen && statementData && (
        <StatementModal
          committee={session.committee}
          member={members[0]}
          year={statementData.year}
          payments={statementData.payments}
          loans={statementData.loans}
          onClose={() => setStatementOpen(false)}
        />
      )}
    </div>
  );
}

function pageBtnStyle(disabled) {
  return {
    border: `1px solid ${T.line}`,
    background: disabled ? T.paper : T.surface,
    borderRadius: 7,
    cursor: disabled ? "default" : "pointer",
    color: disabled ? T.inkFaint : T.green,
    padding: "6px 9px",
    opacity: disabled ? 0.6 : 1,
  };
}
