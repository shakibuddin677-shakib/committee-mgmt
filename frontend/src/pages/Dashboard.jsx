import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Wallet, HandCoins, PiggyBank, Users, TrendingUp, MessageCircle, FileDown } from "lucide-react";
import { apiRequest } from "../api/client";
import { T, monthNames, fonts } from "../styles/tokens";
import { Card, ErrorBanner, SectionTitle, Rupee, Skeleton, Avatar, Btn, Spinner } from "../components/ui";
import { useI18n } from "../i18n/I18nContext";
import { useToast } from "../components/Toast";

export default function Dashboard({ session }) {
  const isAdmin = session.role === "admin";
  const token = isAdmin ? session.adminToken : session.memberToken;
  const committeeId = session.committee._id || session.committee.id;
  const { t } = useI18n();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);

  const [year, setYear] = useState(new Date().getFullYear());
  const [payments, setPayments] = useState([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [hoverMonth, setHoverMonth] = useState(null);

  // For the admin-only "this month's pending" widget
  const [allMembers, setAllMembers] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(true);

  // Full committee report → WhatsApp (loaded on demand, only when shared)
  const [sharingReport, setSharingReport] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest(`/committees/${committeeId}/dashboard/summary`, { token });
      setSummary(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [committeeId, token]);

  const loadChartData = useCallback(async () => {
    setChartLoading(true);
    try {
      const path = isAdmin
        ? `/committees/${committeeId}/payments?year=${year}`
        : `/committees/${committeeId}/payments/member/${session.memberUser?.id}?year=${year}`;
      const data = await apiRequest(path, { token });
      setPayments(data.payments || []);
    } catch {
      setPayments([]);
    } finally {
      setChartLoading(false);
    }
  }, [committeeId, token, year, isAdmin, session.memberUser]);

  const loadPendingData = useCallback(async () => {
    if (!isAdmin) return;
    setPendingLoading(true);
    try {
      const data = await apiRequest(`/committees/${committeeId}/members`, { token });
      setAllMembers(data.members || []);
    } catch {
      setAllMembers([]);
    } finally {
      setPendingLoading(false);
    }
  }, [committeeId, token, isAdmin]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadChartData(); }, [loadChartData]);
  useEffect(() => { loadPendingData(); }, [loadPendingData]);

  // Builds the combined payment-register + loan-ledger + totals report as
  // a formatted PDF (see utils/reportPdf.js). Members and payments for the
  // year are already in state; loans are fetched fresh here since the
  // dashboard doesn't otherwise need the full list.
  //
  // jsPDF + html2canvas are dynamically imported here rather than at the
  // top of the file so they're excluded from the main bundle — most
  // visitors never click "share report", so there's no reason to make
  // everyone download that code upfront.
  const buildReportPdfFile = async () => {
    const [{ buildCommitteeReportPdfFile }, membersData, loansData] = await Promise.all([
      import("../utils/reportPdf"),
      allMembers.length > 0 ? Promise.resolve({ members: allMembers }) : apiRequest(`/committees/${committeeId}/members`, { token }),
      apiRequest(`/committees/${committeeId}/loans`, { token }),
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
      members: membersData.members || [],
      payments,
      loans: loansData.loans || [],
      summary,
      monthNames,
      labels,
    });
  };

  const shareFullReport = async () => {
    // Opened synchronously, before any await, so it carries this click's
    // "user activation" — see the big comment on sharePdfOnWhatsApp in
    // utils/reportPdf.js for why that matters. navigator.share() itself
    // doesn't need this (it's closed automatically if that path is used),
    // it's only needed for the download-fallback's wa.me redirect, which
    // might otherwise get silently popup-blocked after the PDF (html2canvas)
    // takes a moment to render.
    let preOpenedWindow = null;
    try {
      preOpenedWindow = window.open("", "_blank");
    } catch {
      // Some browsers/extensions block even this — fine, sharePdfOnWhatsApp
      // just falls back to a plain window.open() attempt at that point.
    }

    setSharingReport(true);
    try {
      const file = await buildReportPdfFile();
      const { sharePdfOnWhatsApp } = await import("../utils/reportPdf"); // already cached from the build step above
      const result = await sharePdfOnWhatsApp(file, {
        title: t("report.title"),
        text: `${session.committee.name} — ${t("report.title")} ${year}`,
        preOpenedWindow,
      });
      if (result === "shared") {
        toast.success(t("report.pdfShared"));
      } else if (result === "downloaded") {
        toast.success(t("report.pdfDownloaded"));
      } else if (result === "failed") {
        toast.error(t("toast.error"));
      }
      // "cancelled" — the person closed the share sheet themselves, no toast needed
    } catch (e) {
      try { preOpenedWindow?.close(); } catch { /* ignore */ }
      toast.error(e.message || t("toast.error"));
    } finally {
      setSharingReport(false);
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

  const monthArr = new Array(12).fill(0);
  payments.forEach((p) => { monthArr[p.month] += p.amount || 0; });
  const yearTotal = monthArr.reduce((a, b) => a + b, 0);
  const maxMonth = Math.max(...monthArr, 1);
  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const currentYear = now.getFullYear();

  // Pending = active members who don't have a payment record for the
  // current calendar month/year. Only meaningful when we're viewing the
  // current year's chart data (the payments list is scoped by `year`).
  const pendingMembers = useMemo(() => {
    if (!isAdmin || year !== currentYear) return [];
    const paidIds = new Set(
      payments.filter((p) => p.month === currentMonthIdx).map((p) => p.member?._id || p.member)
    );
    return allMembers.filter((m) => m.active !== false && !paidIds.has(m._id));
  }, [isAdmin, year, currentYear, payments, currentMonthIdx, allMembers]);

  const adminStats = summary && [
    { label: t("dashboard.totalCollected"), value: summary.totalCollected, icon: PiggyBank },
    { label: t("dashboard.outstanding"), value: summary.outstanding, icon: HandCoins, color: T.rust },
    { label: t("dashboard.balance"), value: summary.balanceInHand, icon: Wallet },
    { label: t("dashboard.activeMembers"), plain: summary.activeMembers, icon: Users },
  ];
  const memberStats = summary && [
    { label: t("dashboard.youPaid"), value: summary.totalPaid, icon: PiggyBank },
    { label: t("dashboard.youBorrowed"), value: summary.totalBorrowed, icon: HandCoins },
    { label: t("dashboard.youRepaid"), value: summary.totalRepaidByMe, icon: Wallet },
    { label: t("dashboard.loanOutstanding"), value: summary.outstandingLoan, icon: TrendingUp, color: summary.outstandingLoan > 0 ? T.rust : T.green },
  ];
  const stats = isAdmin ? adminStats : memberStats;
  const currentMonthLabel = monthNames[currentMonthIdx];

  return (
    <div>
      <SectionTitle
        subtitle={isAdmin ? `${session.committee.name} · ${t("dashboard.subtitle")}` : t("dashboard.subtitleMember")}
        action={isAdmin && !loading && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn variant="ghost" onClick={downloadReport} disabled={downloadingReport}>
              {downloadingReport ? <Spinner /> : <FileDown size={15} />} {t("report.downloadButton")}
            </Btn>
            <Btn variant="ghost" onClick={shareFullReport} disabled={sharingReport} style={{ color: "#25D366", borderColor: "#25D36655" }}>
              {sharingReport ? <Spinner /> : <MessageCircle size={15} />} {t("report.shareButton")}
            </Btn>
          </div>
        )}
      >
        {isAdmin ? t("dashboard.title") : t("dashboard.titleMember")}
      </SectionTitle>
      <ErrorBanner message={error} />

      <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 24 }}>
        {loading || !stats
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <Skeleton width={110} height={11} />
                <Skeleton width={80} height={24} style={{ marginTop: 12 }} />
              </Card>
            ))
          : stats.map((s, i) => <StatCard key={i} {...s} delay={i * 50} />)}
      </div>

      {isAdmin && (
        <Card hover style={{ marginBottom: 24 }} className="fade-up">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div>
              <p style={{ fontFamily: fonts.display, fontSize: 16, fontWeight: 600, color: T.green, margin: 0 }}>
                {t("dashboard.pendingTitle")}
              </p>
              {!pendingLoading && (
                <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "3px 0 0 0" }}>
                  {pendingMembers.length > 0
                    ? t("dashboard.pendingSubtitle", { count: pendingMembers.length, plural: pendingMembers.length === 1 ? "" : "s", month: currentMonthLabel })
                    : t("dashboard.pendingNone", { month: currentMonthLabel })}
                </p>
              )}
            </div>
          </div>

          {pendingLoading ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} width={140} height={40} style={{ borderRadius: 8 }} />)}
            </div>
          ) : pendingMembers.length === 0 ? (
            <p style={{ fontSize: 13, color: T.inkSoft, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              {t("dashboard.pendingAllPaid")}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {pendingMembers.map((m) => (
                <div key={m._id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: T.rustTint }}>
                  <Avatar name={m.name} size={30} tone="gold" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</p>
                    <p className="ltr-field" style={{ margin: 0, fontSize: 11.5, color: T.inkSoft }}>{m.phone}</p>
                  </div>
                  <Rupee value={m.monthlyAmount} size={13} color={T.rust} />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card hover>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
          <div>
            <p style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: 600, color: T.green, margin: 0 }}>
              {t("dashboard.monthlyCollection")} — {year}
            </p>
            <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "3px 0 0 0" }}>
              {t("dashboard.totalThisYear")}: <Rupee value={yearTotal} size={12.5} />
            </p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setYear((y) => y - 1)} style={navBtnStyle} className="icon-btn"><ChevronLeft size={18} /></button>
            <button onClick={() => setYear((y) => y + 1)} style={navBtnStyle} className="icon-btn"><ChevronRight size={18} /></button>
          </div>
        </div>

        {/* Selected-month readout — a normal, full-width block (not a
            floating tooltip glued to a narrow bar) so it can never overlap
            neighbouring bars or labels, no matter how narrow the screen is.
            Always reserves its line height so the chart doesn't jump when a
            bar is tapped. */}
        <div
          style={{
            minHeight: 30, display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 10, borderRadius: 8,
            background: hoverMonth !== null && monthArr[hoverMonth] > 0 ? T.greenDeep : "transparent",
            transition: "background 0.15s ease",
          }}
        >
          {hoverMonth !== null && monthArr[hoverMonth] > 0 && (
            <p className="pop-in" style={{ margin: 0, padding: "5px 14px", fontSize: 13, fontFamily: fonts.mono, color: T.paper, fontWeight: 600 }}>
              {monthNames[hoverMonth]} {year} · ₹{monthArr[hoverMonth].toLocaleString("en-IN")}
            </p>
          )}
        </div>

        {chartLoading ? (
          <div className="month-chart-row" style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 150 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} width="100%" height={30 + (i % 5) * 18} style={{ borderRadius: "4px 4px 0 0" }} />
            ))}
          </div>
        ) : (
          <div className="month-chart-row" style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 160 }}>
            {monthArr.map((v, i) => {
              const isHover = hoverMonth === i;
              const isCurrent = i === currentMonthIdx && year === currentYear;
              return (
                <div
                  key={i}
                  onMouseEnter={() => setHoverMonth(i)}
                  onMouseLeave={() => setHoverMonth(null)}
                  onClick={() => setHoverMonth(i)}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: Math.max(4, (v / maxMonth) * 120),
                      background: v > 0
                        ? `linear-gradient(180deg, ${isHover ? T.gold : T.goldSoft}, ${T.gold})`
                        : T.lineSoft,
                      borderRadius: "5px 5px 2px 2px",
                      transition: "height 0.4s cubic-bezier(0.22,1,0.36,1), background 0.15s ease",
                      outline: isCurrent ? `1.5px dashed ${T.green}` : "none",
                      outlineOffset: 2,
                    }}
                  />
                  <span style={{ fontSize: 10.5, color: isCurrent ? T.green : T.inkSoft, fontWeight: isCurrent ? 700 : 500 }}>
                    {monthNames[i]}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value, plain, color, icon: Icon, delay = 0 }) {
  return (
    <Card hover className="fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <p style={{ fontSize: 12, color: T.inkSoft, margin: 0, fontWeight: 500, lineHeight: 1.4, maxWidth: "80%" }}>{label}</p>
        {Icon && (
          <div style={{ width: 30, height: 30, borderRadius: 8, background: T.greenTint, color: color || T.green, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={15} />
          </div>
        )}
      </div>
      <div style={{ marginTop: 10 }}>
        {plain !== undefined ? (
          <span className="ltr-field" style={{ fontFamily: fonts.mono, fontSize: 23, fontWeight: 600, color: T.ink }}>{plain}</span>
        ) : (
          <Rupee value={value} size={23} color={color} />
        )}
      </div>
    </Card>
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
