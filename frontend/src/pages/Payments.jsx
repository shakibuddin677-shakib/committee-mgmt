import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Wallet, Info, CheckCheck, Download, Receipt as ReceiptIcon, MessageCircle, FileDown } from "lucide-react";
import { apiRequest } from "../api/client";
import { T, monthNames, fonts } from "../styles/tokens";
import { ErrorBanner, Spinner, SectionTitle, Rupee, EmptyState, Skeleton, Btn } from "../components/ui";
import { useI18n } from "../i18n/I18nContext";
import { useToast } from "../components/Toast";
import { useConfirm } from "../components/ConfirmDialog";
import { downloadCsv } from "../utils/csv";
import ReceiptModal from "../components/ReceiptModal";

export default function Payments({ session }) {
  const isAdmin = session.role === "admin";
  const token = isAdmin ? session.adminToken : session.memberToken;
  const committeeId = session.committee._id || session.committee.id;
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [members, setMembers] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [payments, setPayments] = useState([]); // flat list from API
  const [editingCell, setEditingCell] = useState(null);
  const [cellVal, setCellVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [receipt, setReceipt] = useState(null); // { member, month }
  const [sharing, setSharing] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);

  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const isCurrentYear = year === now.getFullYear();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (isAdmin) {
        const [membersData, paymentsData] = await Promise.all([
          apiRequest(`/committees/${committeeId}/members`, { token }),
          apiRequest(`/committees/${committeeId}/payments?year=${year}`, { token }),
        ]);
        setMembers(membersData.members || []);
        setPayments(paymentsData.payments || []);
      } else {
        const paymentsData = await apiRequest(
          `/committees/${committeeId}/payments/member/${session.memberUser.id}?year=${year}`,
          { token }
        );
        setMembers([{ _id: session.memberUser.id, name: session.memberUser.name, phone: session.memberUser.phone }]);
        setPayments(paymentsData.payments || []);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [committeeId, token, year, isAdmin, session.memberUser]);

  useEffect(() => { load(); }, [load]);

  const getAmount = (memberId, month) => {
    const p = payments.find((p) => (p.member?._id || p.member) === memberId && p.month === month);
    return p ? p.amount : undefined;
  };

  const openCell = (memberId, month) => {
    if (!isAdmin) return;
    setEditingCell({ memberId, month });
    setCellVal(String(getAmount(memberId, month) ?? ""));
  };

  const saveCell = async () => {
    const { memberId, month } = editingCell;
    setSaving(true);
    try {
      await apiRequest(`/committees/${committeeId}/payments`, {
        method: "POST",
        token,
        body: { member: memberId, year, month, amount: Number(cellVal) || 0 },
      });
      setEditingCell(null);
      toast.success(t("toast.paymentSaved"));
      load();
    } catch (e) {
      setError(e.message);
      toast.error(e.message || t("toast.error"));
      setEditingCell(null);
    } finally {
      setSaving(false);
    }
  };

  const pendingMembers = useMemo(() => {
    if (!isAdmin || !isCurrentYear) return [];
    const paidIds = new Set(
      payments.filter((p) => p.month === currentMonthIdx).map((p) => p.member?._id || p.member)
    );
    return members.filter((m) => !paidIds.has(m._id));
  }, [isAdmin, isCurrentYear, payments, currentMonthIdx, members]);

  const markAllPaid = async () => {
    const ok = await confirm({
      title: t("confirm.bulkPaidTitle"),
      body: t("confirm.bulkPaidBody", { count: pendingMembers.length, plural: pendingMembers.length === 1 ? "" : "s" }),
      confirmLabel: t("confirm.bulkPaidConfirm"),
      danger: false,
    });
    if (!ok) return;

    setBulkSaving(true);
    setError("");
    try {
      await Promise.all(
        pendingMembers.map((m) =>
          apiRequest(`/committees/${committeeId}/payments`, {
            method: "POST",
            token,
            body: { member: m._id, year, month: currentMonthIdx, amount: m.monthlyAmount || 0 },
          })
        )
      );
      toast.success(t("payments.allPaidToast"));
      load();
    } catch (e) {
      setError(e.message);
      toast.error(e.message || t("toast.error"));
    } finally {
      setBulkSaving(false);
    }
  };

  const exportCsv = () => {
    downloadCsv(
      `${session.committee.name}-payments-${year}`,
      [
        { label: t("payments.member"), get: (m) => m.name },
        ...monthNames.map((mn, month) => ({ label: mn, get: (m) => getAmount(m._id, month) ?? "" })),
        {
          label: t("payments.total"),
          get: (m) => payments.filter((p) => (p.member?._id || p.member) === m._id).reduce((s, p) => s + p.amount, 0),
        },
      ],
      members
    );
  };

  // Same full committee-report PDF as the Dashboard's share button (payment
  // register + loan ledger + overall summary) — this page only keeps its
  // own members/payments in state, so loans and the summary totals are
  // fetched fresh here, on demand, only when the admin actually shares.
  //
  // jsPDF + html2canvas together are a substantial chunk of code that most
  // visitors never need (only admins who click share/download ever use
  // them) — dynamically importing here, instead of a static top-of-file
  // import, keeps them out of the main bundle and lets Vite split them
  // into their own chunk that only loads on demand.
  const buildReportPdfFile = async () => {
    const [{ buildCommitteeReportPdfFile }, loansData, summaryData] = await Promise.all([
      import("../utils/reportPdf"),
      apiRequest(`/committees/${committeeId}/loans`, { token }),
      apiRequest(`/committees/${committeeId}/dashboard/summary`, { token }),
    ]);

    const labels = {
      title: t("report.title"),
      code: t("report.code"),
      paymentRegister: t("report.paymentRegister"),
      loanDetails: t("report.loanDetails"),
      summary: t("report.summary"),
      member: t("payments.member"),
      purpose: t("loans.purpose"),
      total: t("payments.total"),
      grandTotal: t("report.grandTotal"),
      totalCollected: t("dashboard.totalCollected"),
      totalLoaned: t("report.totalLoaned"),
      totalRepaid: t("report.totalRepaid"),
      outstanding: t("dashboard.outstanding"),
      balanceInHand: t("dashboard.balance"),
      noLoans: t("report.noLoans"),
      given: t("loans.given"),
      due: t("loans.due"),
      amount: t("loans.amount"),
      principal: t("loans.principal"),
      interest: t("loans.interest"),
      totalDue: t("report.totalDue"),
      repaid: t("loans.repaid"),
      balance: t("report.balance"),
      status: t("report.status"),
      active: t("report.active"),
      closed: t("loans.repaid"),
      overdue: t("loans.overdue"),
      generatedOn: t("report.generatedOn"),
      sentFrom: t("report.sentFrom"),
      page: t("report.page"),
      of: t("report.of"),
    };

    return buildCommitteeReportPdfFile({
      committee: session.committee,
      year,
      members,
      payments,
      loans: loansData.loans || [],
      summary: summaryData,
      monthNames,
      labels,
    });
  };

  const shareWhatsApp = async () => {
    setSharing(true);
    try {
      const file = await buildReportPdfFile();
      const { sharePdfOnWhatsApp } = await import("../utils/reportPdf"); // already cached from the build step above
      const result = await sharePdfOnWhatsApp(file, {
        title: t("report.title"),
        text: `${session.committee.name} — ${t("report.title")} ${year}`,
      });
      if (result === "shared") {
        toast.success(t("report.pdfShared"));
      } else if (result === "downloaded") {
        toast.success(t("report.pdfDownloaded"));
      } else if (result === "failed") {
        toast.error(t("toast.error"));
      }
    } catch (e) {
      toast.error(e.message || t("toast.error"));
    } finally {
      setSharing(false);
    }
  };

  const downloadReport = async () => {
    setDownloadingReport(true);
    try {
      const file = await buildReportPdfFile();
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.error(e.message || t("toast.error"));
    } finally {
      setDownloadingReport(false);
    }
  };

  return (
    <div>
      <SectionTitle
        subtitle={isAdmin ? t("payments.subtitleAdmin") : t("payments.subtitleMember")}
        action={isAdmin && members.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn variant="ghost" onClick={exportCsv}>
              <Download size={15} /> {t("payments.exportCsv")}
            </Btn>
            <Btn variant="ghost" onClick={downloadReport} disabled={downloadingReport}>
              {downloadingReport ? <Spinner /> : <FileDown size={15} />} {t("report.downloadButton")}
            </Btn>
            <Btn variant="ghost" onClick={shareWhatsApp} disabled={sharing} style={{ color: "#25D366", borderColor: "#25D36655" }}>
              {sharing ? <Spinner /> : <MessageCircle size={15} />} {t("payments.shareWhatsapp")}
            </Btn>
            {isCurrentYear && pendingMembers.length > 0 && (
              <Btn variant="primary" onClick={markAllPaid} disabled={bulkSaving}>
                {bulkSaving ? <Spinner /> : <CheckCheck size={15} />} {t("payments.markAllPaid")} ({pendingMembers.length})
              </Btn>
            )}
          </div>
        )}
      >
        {t("payments.title")}
      </SectionTitle>
      <ErrorBanner message={error} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button onClick={() => setYear((y) => y - 1)} style={navBtnStyle} className="icon-btn"><ChevronLeft size={16} /></button>
        <span className="ltr-field" style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 18, color: T.green, minWidth: 46, textAlign: "center" }}>{year}</span>
        <button onClick={() => setYear((y) => y + 1)} style={navBtnStyle} className="icon-btn"><ChevronRight size={16} /></button>
        {saving && <Spinner />}
      </div>

      {loading ? (
        <div style={{ border: `1px solid ${T.line}`, borderRadius: T.radiusMd, background: T.surface, padding: 20 }}>
          <Skeleton height={220} />
        </div>
      ) : members.length === 0 ? (
        <EmptyState icon={Wallet} title={t("payments.empty")} subtitle={t("payments.emptySub")} />
      ) : (
        <div className="table-scroll table-fade-right" style={{ overflowX: "auto", border: `1px solid ${T.line}`, borderRadius: T.radiusMd, background: T.surface, boxShadow: T.shadowSm }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 780 }}>
            <thead>
              <tr style={{ background: `linear-gradient(155deg, ${T.greenSoft}, ${T.green})` }}>
                <th style={{ textAlign: "left", padding: "12px 16px", color: T.paper, fontSize: 12.5, fontWeight: 600, position: "sticky", left: 0, background: T.green, borderTopLeftRadius: T.radiusMd }}>
                  {t("payments.member")}
                </th>
                {monthNames.map((mn) => (
                  <th key={mn} style={{ padding: "12px 6px", color: T.paper, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.03em" }}>{mn}</th>
                ))}
                <th style={{ padding: "12px 16px", color: T.paper, fontSize: 12.5, fontWeight: 600, borderTopRightRadius: T.radiusMd }}>{t("payments.total")}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, idx) => {
                const rowTotal = payments
                  .filter((p) => (p.member?._id || p.member) === m._id)
                  .reduce((s, p) => s + p.amount, 0);
                const rowBg = idx % 2 === 0 ? T.surface : "#FAF6E9";
                return (
                  <tr key={m._id} className="row-hover" style={{ background: rowBg }}>
                    <td
                      style={{
                        padding: "10px 16px", fontSize: 13, fontWeight: 600, color: T.ink,
                        position: "sticky", left: 0, background: rowBg,
                        borderRight: `1px solid ${T.line}`, borderBottom: `1px solid ${T.lineSoft}`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.name}
                    </td>
                    {monthNames.map((_, month) => {
                      const v = getAmount(m._id, month);
                      const isEditing = editingCell?.memberId === m._id && editingCell?.month === month;
                      return (
                        <td
                          key={month}
                          onClick={() => openCell(m._id, month)}
                          style={{
                            padding: "7px", textAlign: "center", fontSize: 12.5,
                            borderBottom: `1px solid ${T.lineSoft}`,
                            cursor: isAdmin ? "pointer" : "default",
                            color: v ? T.green : T.inkFaint,
                            fontWeight: v ? 600 : 400,
                            fontFamily: fonts.mono,
                            transition: "background 0.12s ease",
                          }}
                        >
                          {isEditing ? (
                            <input
                              autoFocus
                              value={cellVal}
                              onChange={(e) => setCellVal(e.target.value)}
                              onBlur={saveCell}
                              onKeyDown={(e) => e.key === "Enter" && saveCell()}
                              style={{ width: 60, fontSize: 16, padding: "4px 5px", border: `1.5px solid ${T.gold}`, borderRadius: 5, textAlign: "center", outline: "none" }}
                            />
                          ) : v ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              {v}
                              <button
                                onClick={(e) => { e.stopPropagation(); setReceipt({ member: m, month }); }}
                                title={t("payments.receipt")}
                                style={{ border: "none", background: "transparent", color: T.gold, cursor: "pointer", padding: 0, display: "inline-flex" }}
                              >
                                <ReceiptIcon size={11} />
                              </button>
                            </span>
                          ) : "—"}
                        </td>
                      );
                    })}
                    <td style={{ padding: "10px 16px", textAlign: "right", borderBottom: `1px solid ${T.lineSoft}` }}><Rupee value={rowTotal} size={12.5} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && members.length > 0 && (
        <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.inkFaint, marginTop: 10 }}>
          <Info size={12} /> {t("payments.scrollHint")}
        </p>
      )}

      {receipt && (
        <ReceiptModal
          committee={session.committee}
          member={receipt.member}
          year={year}
          month={receipt.month}
          amount={getAmount(receipt.member._id, receipt.month)}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}

const navBtnStyle = {
  border: `1px solid ${T.line}`,
  background: T.surface,
  borderRadius: 7,
  cursor: "pointer",
  color: T.green,
  padding: "5px 9px",
};
