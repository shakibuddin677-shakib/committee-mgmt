import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Check, X, Trash2, HandCoins, Calendar, Search, AlertOctagon, Download, Clock, ThumbsUp, ThumbsDown } from "lucide-react";
import { apiRequest } from "../api/client";
import { T, fonts } from "../styles/tokens";
import { Card, Btn, Input, ErrorBanner, Spinner, SectionTitle, Rupee, Seal, EmptyState, Skeleton } from "../components/ui";
import { useI18n } from "../i18n/I18nContext";
import { useToast } from "../components/Toast";
import { useConfirm } from "../components/ConfirmDialog";
import { downloadCsv } from "../utils/csv";

export default function Loans({ session }) {
  const isAdmin = session.role === "admin";
  const token = isAdmin ? session.adminToken : session.memberToken;
  const committeeId = session.committee._id || session.committee.id;
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loans, setLoans] = useState([]);
  const [members, setMembers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ member: "", amount: "", purpose: "", givenDate: "", dueDate: "", interestRate: "" });
  const [repayingId, setRepayingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [query, setQuery] = useState("");

  // Member-side "request a loan" form
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestForm, setRequestForm] = useState({ amount: "", purpose: "" });
  const [requesting, setRequesting] = useState(false);

  // Admin-side approve form — which loan id is being approved, plus its draft fields
  const [approvingId, setApprovingId] = useState(null);
  const [approveDraft, setApproveDraft] = useState({ amount: "", givenDate: "", dueDate: "", interestRate: "" });
  const [approveSaving, setApproveSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (isAdmin) {
        const [loansData, membersData] = await Promise.all([
          apiRequest(`/committees/${committeeId}/loans`, { token }),
          apiRequest(`/committees/${committeeId}/members`, { token }),
        ]);
        setLoans(loansData.loans || []);
        setMembers(membersData.members || []);
      } else {
        const data = await apiRequest(`/committees/${committeeId}/loans/member/${session.memberUser.id}`, { token });
        setLoans(data.loans || []);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [committeeId, token, isAdmin, session.memberUser]);

  useEffect(() => { load(); }, [load]);

  const filteredLoans = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return loans;
    return loans.filter((l) => l.member?.name?.toLowerCase().includes(q) || l.purpose?.toLowerCase().includes(q));
  }, [loans, query]);

  const defaultInterestRate = session.committee.interestRate || 0;

  const addLoan = async () => {
    setError("");
    if (!form.member || !form.amount || !form.givenDate || !form.dueDate) {
      setError(t("loans.validation"));
      return;
    }
    setSaving(true);
    try {
      await apiRequest(`/committees/${committeeId}/loans`, {
        method: "POST",
        token,
        body: {
          ...form,
          amount: Number(form.amount),
          interestRate: form.interestRate === "" ? undefined : Number(form.interestRate),
        },
      });
      setForm({ member: "", amount: "", purpose: "", givenDate: "", dueDate: "", interestRate: "" });
      setShowForm(false);
      toast.success(t("toast.loanAdded"));
      load();
    } catch (e) {
      setError(e.message);
      toast.error(e.message || t("toast.error"));
    } finally {
      setSaving(false);
    }
  };

  const submitRequest = async () => {
    setError("");
    if (!requestForm.amount || Number(requestForm.amount) <= 0) {
      setError(t("loans.requestValidation"));
      return;
    }
    setRequesting(true);
    try {
      await apiRequest(`/committees/${committeeId}/loans/request`, {
        method: "POST",
        token,
        body: { amount: Number(requestForm.amount), purpose: requestForm.purpose },
      });
      setRequestForm({ amount: "", purpose: "" });
      setShowRequestForm(false);
      toast.success(t("toast.loanRequested"));
      load();
    } catch (e) {
      setError(e.message);
      toast.error(e.message || t("toast.error"));
    } finally {
      setRequesting(false);
    }
  };

  const openApprove = (loan) => {
    setApprovingId(loan._id);
    const todayStr = new Date().toISOString().slice(0, 10);
    setApproveDraft({ amount: String(loan.amount), givenDate: todayStr, dueDate: "", interestRate: String(defaultInterestRate) });
  };

  const submitApprove = async (loan) => {
    setError("");
    if (!approveDraft.givenDate || !approveDraft.dueDate) {
      setError(t("loans.validation"));
      return;
    }
    setApproveSaving(true);
    try {
      await apiRequest(`/committees/${committeeId}/loans/${loan._id}/approve`, {
        method: "PUT",
        token,
        body: {
          givenDate: approveDraft.givenDate,
          dueDate: approveDraft.dueDate,
          amount: Number(approveDraft.amount) || loan.amount,
          interestRate: approveDraft.interestRate === "" ? undefined : Number(approveDraft.interestRate),
        },
      });
      setApprovingId(null);
      toast.success(t("toast.loanApproved"));
      load();
    } catch (e) {
      setError(e.message);
      toast.error(e.message || t("toast.error"));
    } finally {
      setApproveSaving(false);
    }
  };

  const rejectRequest = async (loan) => {
    const ok = await confirm({
      title: t("confirm.rejectLoanTitle"),
      body: t("confirm.rejectLoanBody"),
    });
    if (!ok) return;

    setError("");
    setRejectingId(loan._id);
    try {
      await apiRequest(`/committees/${committeeId}/loans/${loan._id}/reject`, { method: "PUT", token, body: {} });
      toast.success(t("toast.loanRejected"));
      load();
    } catch (e) {
      setError(e.message);
      toast.error(e.message || t("toast.error"));
    } finally {
      setRejectingId(null);
    }
  };

  const markRepaid = async (loan) => {
    setError("");
    setRepayingId(loan._id);
    try {
      // totalDue = principal + interest — the loan's own virtual field
      // from the API already accounts for its snapshotted interestRate.
      await apiRequest(`/committees/${committeeId}/loans/${loan._id}`, {
        method: "PUT",
        token,
        body: { repaidAmount: loan.totalDue ?? loan.amount },
      });
      toast.success(t("toast.loanRepaid"));
      load();
    } catch (e) {
      setError(e.message);
      toast.error(e.message || t("toast.error"));
    } finally {
      setRepayingId(null);
    }
  };

  const removeLoan = async (loan) => {
    const ok = await confirm({
      title: t("confirm.deleteLoanTitle"),
      body: t("confirm.deleteLoanBody"),
    });
    if (!ok) return;

    setError("");
    setDeletingId(loan._id);
    try {
      await apiRequest(`/committees/${committeeId}/loans/${loan._id}`, { method: "DELETE", token });
      toast.success(t("toast.loanDeleted"));
      load();
    } catch (e) {
      setError(e.message);
      toast.error(e.message || t("toast.error"));
    } finally {
      setDeletingId(null);
    }
  };

  // Only an active loan (one with a real due date) can be overdue —
  // requested/rejected loans never have a dueDate at all.
  const isOverdue = (loan) => loan.status === "active" && loan.dueDate && new Date(loan.dueDate) < new Date();

  const statusLabel = (l) =>
    l.status === "requested" ? t("loans.pending")
    : l.status === "rejected" ? t("loans.rejected")
    : l.status === "closed" ? t("loans.repaid")
    : isOverdue(l) ? t("loans.overdue")
    : t("loans.outstanding");

  const exportCsv = () => {
    downloadCsv(
      `${session.committee.name}-loans`,
      [
        { label: t("payments.member"), get: (l) => l.member?.name || "" },
        { label: t("loans.principal"), get: (l) => l.amount },
        { label: t("loans.interestRate"), get: (l) => l.interestRate || 0 },
        { label: t("loans.totalDue"), get: (l) => l.totalDue ?? l.amount },
        { label: t("loans.repaid"), get: (l) => l.repaidAmount || 0 },
        { label: t("loans.purpose"), get: (l) => l.purpose || "" },
        { label: t("loans.givenDate"), get: (l) => (l.givenDate ? new Date(l.givenDate).toLocaleDateString() : "") },
        { label: t("loans.dueDate"), get: (l) => (l.dueDate ? new Date(l.dueDate).toLocaleDateString() : "") },
        { label: t("report.status"), get: (l) => statusLabel(l) },
      ],
      filteredLoans
    );
  };

  return (
    <div>
      <SectionTitle
        subtitle={t("loans.subtitleCount", { count: loans.length, plural: loans.length === 1 ? "" : "s" })}
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {isAdmin && !showForm && loans.length > 0 && (
              <Btn variant="ghost" onClick={exportCsv}>
                <Download size={15} /> {t("loans.exportCsv")}
              </Btn>
            )}
            {isAdmin && !showForm && (
              <Btn variant="primary" onClick={() => setShowForm(true)}>
                <Plus size={15} /> {t("loans.giveLoan")}
              </Btn>
            )}
            {!isAdmin && !showRequestForm && (
              <Btn variant="primary" onClick={() => setShowRequestForm(true)}>
                <HandCoins size={15} /> {t("loans.requestLoan")}
              </Btn>
            )}
          </div>
        }
      >
        {t("loans.title")}
      </SectionTitle>

      <ErrorBanner message={error} />

      {isAdmin && showForm && (
        <Card style={{ marginBottom: 18, borderColor: T.gold }} className="pop-in">
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: T.goldTint, color: "#8A6416", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <HandCoins size={15} />
            </div>
            <p style={{ fontFamily: fonts.display, fontSize: 15.5, fontWeight: 600, color: T.green, margin: 0 }}>
              {t("loans.newLoan")}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select
              value={form.member}
              onChange={(e) => setForm({ ...form, member: e.target.value })}
              style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 16, flex: 1, minWidth: 150, background: T.surface, color: T.ink }}
            >
              <option value="">{t("loans.selectMember")}</option>
              {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
            <Input className="ltr-field" placeholder={t("loans.amount")} type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={{ width: 120 }} />
            <Input
              className="ltr-field"
              placeholder={`${t("loans.interestRate")} (${defaultInterestRate})`}
              type="number"
              value={form.interestRate}
              onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
              style={{ width: 130 }}
            />
            <Input placeholder={t("loans.purpose")} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} style={{ flex: 1, minWidth: 140 }} />
            <Input className="ltr-field" type="date" value={form.givenDate} onChange={(e) => setForm({ ...form, givenDate: e.target.value })} style={{ width: 155 }} />
            <Input className="ltr-field" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} style={{ width: 155 }} />
          </div>
          <p style={{ fontSize: 11.5, color: T.inkFaint, margin: "8px 0 0 0" }}>{t("loans.interestRateHint")}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Btn variant="ghost" onClick={() => { setShowForm(false); setError(""); }}>{t("common.cancel")}</Btn>
            <Btn variant="primary" onClick={addLoan} disabled={saving}>
              {saving ? <Spinner /> : <Check size={15} />} {t("loans.saveLoan")}
            </Btn>
          </div>
        </Card>
      )}

      {!isAdmin && showRequestForm && (
        <Card style={{ marginBottom: 18, borderColor: T.gold }} className="pop-in">
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: T.goldTint, color: "#8A6416", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <HandCoins size={15} />
            </div>
            <p style={{ fontFamily: fonts.display, fontSize: 15.5, fontWeight: 600, color: T.green, margin: 0 }}>
              {t("loans.requestLoan")}
            </p>
          </div>
          <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "0 0 14px 0", lineHeight: 1.5 }}>{t("loans.requestSub")}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Input
              className="ltr-field"
              placeholder={t("loans.amount")}
              type="number"
              value={requestForm.amount}
              onChange={(e) => setRequestForm({ ...requestForm, amount: e.target.value })}
              style={{ width: 140 }}
            />
            <Input
              placeholder={t("loans.purpose")}
              value={requestForm.purpose}
              onChange={(e) => setRequestForm({ ...requestForm, purpose: e.target.value })}
              style={{ flex: 1, minWidth: 160 }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Btn variant="ghost" onClick={() => { setShowRequestForm(false); setError(""); }}>{t("common.cancel")}</Btn>
            <Btn variant="primary" onClick={submitRequest} disabled={requesting}>
              {requesting ? <Spinner /> : <HandCoins size={15} />} {t("loans.submitRequest")}
            </Btn>
          </div>
        </Card>
      )}

      {!loading && loans.length > 0 && (
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
          {Array.from({ length: 3 }).map((_, i) => <Card key={i}><Skeleton height={44} /></Card>)}
        </div>
      ) : loans.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title={t("loans.empty")}
          subtitle={isAdmin ? t("loans.emptySubAdmin") : t("loans.emptySubMember")}
          action={
            isAdmin && !showForm
              ? <Btn variant="primary" onClick={() => setShowForm(true)}><Plus size={15} /> {t("loans.giveLoan")}</Btn>
              : !isAdmin && !showRequestForm
              ? <Btn variant="primary" onClick={() => setShowRequestForm(true)}><HandCoins size={15} /> {t("loans.requestLoan")}</Btn>
              : undefined
          }
        />
      ) : filteredLoans.length === 0 ? (
        <EmptyState icon={Search} title={t("loans.noMatch", { query })} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredLoans.map((l, idx) => {
            const closed = l.status === "closed";
            const requested = l.status === "requested";
            const rejected = l.status === "rejected";
            const overdue = isOverdue(l);
            const borderColor = requested ? T.gold : rejected ? T.line : overdue ? T.rust : closed ? T.green : T.gold;
            return (
              <Card key={l._id} hover className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 12, borderLeft: `3px solid ${borderColor}`, animationDelay: `${idx * 30}ms` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, color: T.ink, fontSize: 14.5 }}>
                      {l.member?.name || t("common.member")} <span style={{ fontWeight: 400, color: T.inkSoft, fontSize: 12.5 }}>· {l.purpose || t("loans.noPurpose")}</span>
                    </p>
                    <p className="ltr-field" style={{ margin: "4px 0 0 0", fontSize: 12, color: T.inkSoft, display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-start" }}>
                      {requested ? (
                        <><Clock size={11} /> {t("loans.pending")}</>
                      ) : (
                        <><Calendar size={11} /> {t("loans.given")} {l.givenDate ? new Date(l.givenDate).toLocaleDateString() : "—"} · {t("loans.due")} {l.dueDate ? new Date(l.dueDate).toLocaleDateString() : "—"}</>
                      )}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ textAlign: "right" }}>
                      <Rupee value={l.totalDue ?? l.amount} size={16} />
                      {l.interestRate > 0 && (
                        <p className="ltr-field" style={{ margin: "1px 0 0 0", fontSize: 10.5, color: T.inkFaint, textAlign: "right" }}>
                          {t("loans.principal")} ₹{l.amount} + {t("loans.interest")} ₹{l.interestAmount} ({l.interestRate}%)
                        </p>
                      )}
                      {(l.status === "active" || l.status === "closed") && l.repaidAmount > 0 && (
                        <p className="ltr-field" style={{ margin: "1px 0 0 0", fontSize: 10.5, color: T.inkFaint, textAlign: "right" }}>
                          {t("loans.repaidOf", { repaid: `₹${l.repaidAmount}`, total: `₹${l.totalDue ?? l.amount}` })}
                        </p>
                      )}
                    </div>
                    {requested ? (
                      <Seal tone="gold"><Clock size={10} /> {t("loans.pending")}</Seal>
                    ) : rejected ? (
                      <Seal tone="gray"><X size={10} /> {t("loans.rejected")}</Seal>
                    ) : overdue ? (
                      <Seal tone="rust"><AlertOctagon size={10} /> {t("loans.overdue")}</Seal>
                    ) : (
                      <Seal tone={closed ? "green" : "rust"}>{closed ? t("loans.repaid") : t("loans.outstanding")}</Seal>
                    )}

                    {isAdmin && requested && (
                      <>
                        <button
                          onClick={() => openApprove(l)}
                          className="icon-btn"
                          style={{ border: "none", background: "transparent", color: T.green, cursor: "pointer", padding: 6, borderRadius: 6 }}
                          title={t("loans.approve")}
                        >
                          <ThumbsUp size={16} />
                        </button>
                        <button
                          onClick={() => rejectRequest(l)}
                          disabled={rejectingId === l._id}
                          className="icon-btn"
                          style={{ border: "none", background: "transparent", color: T.rust, cursor: "pointer", padding: 6, borderRadius: 6 }}
                          title={t("loans.reject")}
                        >
                          {rejectingId === l._id ? <Spinner color={T.rust} /> : <ThumbsDown size={16} />}
                        </button>
                      </>
                    )}

                    {isAdmin && l.status === "active" && (
                      <button
                        onClick={() => markRepaid(l)}
                        disabled={repayingId === l._id}
                        className="icon-btn"
                        style={{ border: "none", background: "transparent", color: T.green, cursor: "pointer", padding: 6, borderRadius: 6 }}
                        title={t("loans.markRepaid")}
                      >
                        {repayingId === l._id ? <Spinner /> : <Check size={17} />}
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        onClick={() => removeLoan(l)}
                        disabled={deletingId === l._id}
                        className="icon-btn"
                        style={{ border: "none", background: "transparent", color: T.rust, cursor: "pointer", padding: 6, borderRadius: 6 }}
                      >
                        {deletingId === l._id ? <Spinner color={T.rust} /> : <Trash2 size={16} />}
                      </button>
                    )}
                  </div>
                </div>

                {isAdmin && approvingId === l._id && (
                  <div className="pop-in" style={{ borderTop: `1px dashed ${T.line}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: T.green }}>{t("loans.approveTitle")}</p>
                    <p style={{ margin: 0, fontSize: 12, color: T.inkSoft }}>{t("loans.approveSub")}</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Input
                        className="ltr-field"
                        type="number"
                        value={approveDraft.amount}
                        onChange={(e) => setApproveDraft({ ...approveDraft, amount: e.target.value })}
                        placeholder={t("loans.amount")}
                        style={{ width: 120 }}
                      />
                      <Input
                        className="ltr-field"
                        type="number"
                        value={approveDraft.interestRate}
                        onChange={(e) => setApproveDraft({ ...approveDraft, interestRate: e.target.value })}
                        placeholder={t("loans.interestRate")}
                        style={{ width: 130 }}
                      />
                      <Input
                        className="ltr-field"
                        type="date"
                        value={approveDraft.givenDate}
                        onChange={(e) => setApproveDraft({ ...approveDraft, givenDate: e.target.value })}
                        style={{ width: 155 }}
                      />
                      <Input
                        className="ltr-field"
                        type="date"
                        value={approveDraft.dueDate}
                        onChange={(e) => setApproveDraft({ ...approveDraft, dueDate: e.target.value })}
                        style={{ width: 155 }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn variant="ghost" onClick={() => setApprovingId(null)}>{t("common.cancel")}</Btn>
                      <Btn variant="primary" onClick={() => submitApprove(l)} disabled={approveSaving}>
                        {approveSaving ? <Spinner /> : <ThumbsUp size={15} />} {t("loans.confirmApprove")}
                      </Btn>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
