import { jsPDF } from "jspdf";
import "jspdf-autotable";

// jsPDF's built-in fonts (helvetica, times, courier) only cover Latin-1 —
// any Devanagari (Hindi) text passed through them renders as garbled,
// overlapping glyphs instead of actual characters. To fix this, a real
// Unicode font that covers both Devanagari and Latin is fetched once and
// embedded into the PDF, and used for ALL text in the document (English
// included) so there's never a font-switching mismatch mid-report.
const FONT_URL = "/fonts/NotoSansDevanagari.ttf";
const FONT_NAME = "NotoSansDevanagari";
let fontEmbedPromise = null;

async function ensureUnicodeFont(doc) {
  if (!fontEmbedPromise) {
    fontEmbedPromise = fetch(FONT_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load font (${res.status})`);
        return res.arrayBuffer();
      })
      .then((buffer) => {
        let binary = "";
        const bytes = new Uint8Array(buffer);
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary);
      });
  }
  const base64 = await fontEmbedPromise;
  doc.addFileToVFS(`${FONT_NAME}.ttf`, base64);
  // Registered under both "normal" and "bold" styles pointing at the same
  // file — the font has no separate bold weight embedded, but this lets
  // every existing doc.setFont(FONT_NAME, "bold") call keep working
  // without throwing "font not found", it just renders at regular weight.
  doc.addFont(`${FONT_NAME}.ttf`, FONT_NAME, "normal");
  doc.addFont(`${FONT_NAME}.ttf`, FONT_NAME, "bold");
  doc.setFont(FONT_NAME, "normal");
}

// Colors pulled straight from styles/tokens.js (T.*) so the PDF looks like
// a natural extension of the app itself, not a generic export. jsPDF wants
// plain RGB arrays rather than hex strings.
const COLOR = {
  green: [31, 59, 44], // T.green
  gold: [169, 130, 43], // T.gold
  goldTint: [244, 233, 204], // T.goldTint
  rust: [162, 62, 46], // T.rust
  ink: [33, 31, 23], // T.ink
  inkSoft: [97, 92, 72], // T.inkSoft
  line: [220, 211, 180], // T.line
  stripe: [250, 246, 233], // a shade between T.paper and T.surface
  white: [255, 255, 255],
};

const PAGE_W = 210; // A4, mm
const PAGE_H = 297;
const MARGIN = 14;

function rupee(n) {
  return `Rs ${Math.round(n || 0).toLocaleString("en-IN")}`;
}

function drawHeader(doc, committee, year, L) {
  doc.setFillColor(...COLOR.green);
  doc.rect(0, 0, PAGE_W, 26, "F");

  doc.setTextColor(...COLOR.white);
  doc.setFont(FONT_NAME, "bold");
  doc.setFontSize(17);
  doc.text(committee.name, MARGIN, 12);

  doc.setFont(FONT_NAME, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(224, 224, 214);
  doc.text(`${L.title} — ${year}    ·    ${L.code}: ${committee.code}`, MARGIN, 19);

  doc.setFontSize(9);
  doc.text(`${L.generatedOn} ${new Date().toLocaleDateString()}`, PAGE_W - MARGIN, 12, { align: "right" });
}

function drawFooterOnAllPages(doc, committee, L) {
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont(FONT_NAME, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR.inkSoft);
    doc.text(
      `${L.sentFrom} ${committee.name} — Committee Management    ·    ${L.page} ${i} ${L.of} ${totalPages}`,
      PAGE_W / 2,
      PAGE_H - 10,
      { align: "center" }
    );
  }
}

/**
 * Builds the same "committee report" data (payment register + loan ledger
 * + overall summary) as buildCommitteeReportMessage in utils/whatsapp.js,
 * but as an actual formatted PDF document instead of monospace WhatsApp
 * text — a proper page with the app's own colors, a real table grid, and
 * a highlighted summary card, so it reads like a real report rather than
 * a wall of text.
 *
 * @returns {Promise<Blob>} application/pdf blob
 */
export async function buildCommitteeReportPdfBlob({ committee, year, members, payments, loans, summary, monthNames, labels = {} }) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await ensureUnicodeFont(doc);

  const getAmount = (memberId, month) => {
    const p = payments.find((p) => (p.member?._id || p.member) === memberId && p.month === month);
    return p ? p.amount : undefined;
  };

  drawHeader(doc, committee, year, L);

  let cursorY = 34;
  doc.setTextColor(...COLOR.green);
  doc.setFont(FONT_NAME, "bold");
  doc.setFontSize(12.5);
  doc.text(L.paymentRegister, MARGIN, cursorY);
  cursorY += 4;

  // --- Payment register table ---
  let grandTotal = 0;
  const registerBody = members.map((m, idx) => {
    const rowTotal = payments
      .filter((p) => (p.member?._id || p.member) === m._id)
      .reduce((s, p) => s + (p.amount || 0), 0);
    grandTotal += rowTotal;
    const monthCells = monthNames.map((_, month) => {
      const amt = getAmount(m._id, month);
      return amt !== undefined ? amt.toLocaleString("en-IN") : "-";
    });
    return [String(idx + 1), m.name, ...monthCells, rupee(rowTotal)];
  });
  const grandTotalRowIdx = registerBody.length;
  registerBody.push(["", L.grandTotal, ...Array(12).fill(""), rupee(grandTotal)]);

  doc.autoTable({
    head: [["#", L.member, ...monthNames, L.total]],
    body: registerBody,
    startY: cursorY,
    margin: { left: MARGIN, right: MARGIN },
    styles: { font: FONT_NAME, fontSize: 7.3, cellPadding: 1.6, textColor: COLOR.ink, lineColor: COLOR.line, lineWidth: 0.1, valign: "middle" },
    headStyles: { font: FONT_NAME, fillColor: COLOR.green, textColor: COLOR.white, fontStyle: "bold", halign: "center" },
    alternateRowStyles: { fillColor: COLOR.stripe },
    columnStyles: { 0: { cellWidth: 7, halign: "center" }, 1: { cellWidth: 24, fontStyle: "bold" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === grandTotalRowIdx) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = COLOR.goldTint;
      }
    },
  });
  cursorY = doc.lastAutoTable.finalY + 10;

  // --- Loan ledger — only real loans (skip pending/rejected requests) ---
  if (cursorY > PAGE_H - 45) {
    doc.addPage();
    drawHeader(doc, committee, year, L);
    cursorY = 34;
  }
  doc.setTextColor(...COLOR.green);
  doc.setFont(FONT_NAME, "bold");
  doc.setFontSize(12.5);
  doc.text(L.loanDetails, MARGIN, cursorY);
  cursorY += 4;

  const realLoans = (loans || []).filter((l) => l.status === "active" || l.status === "closed");
  if (realLoans.length === 0) {
    doc.setFont(FONT_NAME, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLOR.inkSoft);
    doc.text(L.noLoans, MARGIN, cursorY + 4);
  } else {
    const statusColIdx = 10;
    const loanBody = realLoans.map((l, idx) => {
      const name = l.member?.name || "?";
      const totalDue = l.totalDue ?? l.amount;
      const repaid = l.repaidAmount || 0;
      const outstanding = Math.max(0, totalDue - repaid);
      const isOverdue = l.status === "active" && l.dueDate && new Date(l.dueDate) < new Date();
      const statusLabel = l.status === "closed" ? L.closed : isOverdue ? L.overdue : L.active;
      return [
        String(idx + 1),
        name,
        l.purpose || "—",
        l.givenDate ? new Date(l.givenDate).toLocaleDateString() : "—",
        l.dueDate ? new Date(l.dueDate).toLocaleDateString() : "—",
        rupee(l.amount),
        l.interestRate > 0 ? `${rupee(l.interestAmount || 0)} (${l.interestRate}%)` : "—",
        rupee(totalDue),
        rupee(repaid),
        rupee(outstanding),
        statusLabel,
      ];
    });

    doc.autoTable({
      head: [["#", L.member, L.purpose, L.given, L.due, L.principal, L.interest, L.totalDue, L.repaid, L.balance, L.status]],
      body: loanBody,
      startY: cursorY,
      margin: { left: MARGIN, right: MARGIN },
      styles: { font: FONT_NAME, fontSize: 6.8, cellPadding: 1.4, textColor: COLOR.ink, lineColor: COLOR.line, lineWidth: 0.1, valign: "middle" },
      headStyles: { font: FONT_NAME, fillColor: COLOR.green, textColor: COLOR.white, fontStyle: "bold", halign: "center" },
      alternateRowStyles: { fillColor: COLOR.stripe },
      columnStyles: { 0: { cellWidth: 6, halign: "center" }, 1: { cellWidth: 20, fontStyle: "bold" } },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === statusColIdx) {
          if (data.cell.raw === L.overdue) {
            data.cell.styles.textColor = COLOR.rust;
            data.cell.styles.fontStyle = "bold";
          } else if (data.cell.raw === L.closed) {
            data.cell.styles.textColor = COLOR.green;
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });
  }

  // --- Summary card — its own page, top-right, like a highlighted total box ---
  if (summary) {
    doc.addPage();
    drawHeader(doc, committee, year, L);

    const rows = [
      [L.totalCollected, summary.totalCollected, false],
      [L.totalLoaned, summary.totalLoansGiven, false],
      [L.totalRepaid, summary.totalRepaid, false],
      [L.outstanding, summary.outstanding, true],
      [L.balanceInHand, summary.balanceInHand, false],
    ];
    const boxW = 92;
    const boxX = PAGE_W - MARGIN - boxW;
    const boxY = 34;
    const rowH = 9;
    const boxH = 16 + rows.length * rowH;

    doc.setDrawColor(...COLOR.gold);
    doc.setFillColor(...COLOR.goldTint);
    doc.setLineWidth(0.4);
    doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, "FD");

    doc.setFont(FONT_NAME, "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...COLOR.green);
    doc.text(L.summary, boxX + 6, boxY + 11);

    let ry = boxY + 22;
    rows.forEach(([label, value, isRust]) => {
      doc.setFont(FONT_NAME, "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...COLOR.inkSoft);
      doc.text(label, boxX + 6, ry);
      doc.setFont(FONT_NAME, "bold");
      doc.setFontSize(10);
      doc.setTextColor(...(isRust ? COLOR.rust : COLOR.ink));
      doc.text(rupee(value), boxX + boxW - 6, ry, { align: "right" });
      ry += rowH;
    });
  }

  drawFooterOnAllPages(doc, committee, L);

  return doc.output("blob");
}

/**
 * Same as buildCommitteeReportPdfBlob, wrapped as a File — what's needed
 * to pass to navigator.share({ files: [...] }) or to trigger a download.
 */
export async function buildCommitteeReportPdfFile(args) {
  const blob = await buildCommitteeReportPdfBlob(args);
  const codeOrName = (args.committee.code || args.committee.name || "committee").replace(/\s+/g, "-");
  const filename = `${codeOrName}-report-${args.year}.pdf`;
  return new File([blob], filename, { type: "application/pdf" });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Shares a PDF file straight into WhatsApp as a real attachment wherever
 * the browser supports the Web Share API with files (Chrome/Safari on
 * Android and iOS) — this opens the native share sheet where the person
 * picks WhatsApp themselves, and the PDF goes across as an actual file,
 * not text. A plain wa.me link can only ever pre-fill text, so there's no
 * way to auto-attach a file through it — that's a WhatsApp/browser
 * limitation, not something any web app can work around.
 *
 * Where file sharing isn't supported (most desktop browsers), this falls
 * back to downloading the PDF directly and opening WhatsApp with a short
 * text note asking the person to attach the file they just downloaded —
 * one extra manual step, but they still end up with the same PDF.
 *
 * @returns {"shared" | "downloaded" | "cancelled" | "failed"}
 */
export async function sharePdfOnWhatsApp(file, { title, text } = {}) {
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title, text });
      return "shared";
    }
  } catch (err) {
    // AbortError = person closed the share sheet without picking anything —
    // that's a deliberate cancel, not a failure.
    if (err && err.name === "AbortError") return "cancelled";
    // Otherwise fall through to the download fallback below.
  }

  try {
    downloadBlob(file, file.name);
    const note = encodeURIComponent(
      `${text || "Your committee report"} — the PDF has been downloaded to your device. Attach it here (📎 → Document) to send it.`
    );
    window.open(`https://wa.me/?text=${note}`, "_blank", "noopener,noreferrer");
    return "downloaded";
  } catch {
    return "failed";
  }
}

const DEFAULT_LABELS = {
  title: "Committee Report",
  code: "Code",
  paymentRegister: "Payment Register",
  loanDetails: "Loan Details",
  summary: "Summary",
  member: "Member",
  purpose: "Purpose",
  total: "Total",
  grandTotal: "Grand Total",
  totalCollected: "Total Collected",
  totalLoaned: "Total Loaned",
  totalRepaid: "Total Repaid",
  outstanding: "Outstanding",
  balanceInHand: "Balance in Hand",
  noLoans: "No loans on record.",
  given: "Given",
  due: "Due",
  amount: "Amount",
  principal: "Principal",
  interest: "Interest",
  totalDue: "Total Due",
  repaid: "Repaid",
  balance: "Balance",
  status: "Status",
  active: "Active",
  closed: "Repaid",
  overdue: "Overdue",
  generatedOn: "Generated on",
  sentFrom: "Sent from",
  page: "Page",
  of: "of",
};
