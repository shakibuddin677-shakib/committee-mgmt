import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { Bell } from "lucide-react";
import { apiRequest } from "../api/client";
import { T, fonts } from "../styles/tokens";
import { useI18n } from "../i18n/I18nContext";

const PANEL_WIDTH = 280;
const VIEWPORT_MARGIN = 12;

export default function NotificationBell({ session, tone = "light" }) {
  const isAdmin = session.role === "admin";
  const token = isAdmin ? session.adminToken : session.memberToken;
  const committeeId = session.committee._id || session.committee.id;
  const { t } = useI18n();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [coords, setCoords] = useState(null); // { top, left } in viewport (fixed) coordinates
  const btnRef = useRef(null);
  const isLight = tone === "light";

  const load = useCallback(async () => {
    try {
      const year = new Date().getFullYear();
      const path = isAdmin
        ? `/committees/${committeeId}/payments?year=${year}`
        : `/committees/${committeeId}/payments/member/${session.memberUser?.id}?year=${year}`;
      const data = await apiRequest(path, { token });
      const recent = (data.payments || [])
        .slice()
        .sort((a, b) => new Date(b.paidOn || b.createdAt || 0) - new Date(a.paidOn || a.createdAt || 0))
        .slice(0, 6)
        .map((p) => ({
          id: p._id,
          name: p.member?.name || session.memberUser?.name || t("common.member"),
          amount: p.amount,
          period: `${p.year}/${p.month + 1}`,
          date: p.paidOn || p.createdAt,
        }));
      setItems(recent);
    } catch {
      setItems([]);
    } finally {
      setLoaded(true);
    }
  }, [committeeId, token, isAdmin, session.memberUser, t]);

  useEffect(() => {
    if (open && !loaded) load();
  }, [open, loaded, load]);

  // Compute the dropdown's position from the bell button's actual position
  // on screen (fixed positioning), so it always fits within the viewport —
  // regardless of how narrow the surrounding container (e.g. the sidebar) is.
  const recalcPosition = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = rect.right - PANEL_WIDTH;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN));
    const top = rect.bottom + 8;
    setCoords({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    recalcPosition();
    window.addEventListener("resize", recalcPosition);
    window.addEventListener("scroll", recalcPosition, true);
    return () => {
      window.removeEventListener("resize", recalcPosition);
      window.removeEventListener("scroll", recalcPosition, true);
    };
  }, [open, recalcPosition]);

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className="icon-btn"
        style={{ background: "transparent", border: "none", color: isLight ? T.paper : T.green, cursor: "pointer", padding: 6, borderRadius: 8, opacity: isLight ? 0.85 : 1 }}
      >
        <Bell size={16} />
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
          <div
            className="pop-in"
            style={{
              position: "fixed",
              top: coords ? coords.top : -9999,
              left: coords ? coords.left : -9999,
              width: PANEL_WIDTH,
              maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
              visibility: coords ? "visible" : "hidden",
              background: T.surfaceRaised || T.surface, borderRadius: T.radiusMd,
              zIndex: 50,
              boxShadow: T.shadowLg, border: `1px solid ${T.line}`,
            }}
          >
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${T.lineSoft}`, borderTopLeftRadius: T.radiusMd, borderTopRightRadius: T.radiusMd, background: T.surfaceRaised || T.surface }}>
              <p style={{ margin: 0, fontFamily: fonts.display, fontWeight: 600, fontSize: 13.5, color: T.ink }}>
                {t("activity.title")}
              </p>
            </div>
            <div style={{ maxHeight: 280, overflowY: "auto", borderBottomLeftRadius: T.radiusMd, borderBottomRightRadius: T.radiusMd }}>
              {items.length === 0 ? (
                <p style={{ margin: 0, padding: "16px 14px", fontSize: 12.5, color: T.inkSoft }}>
                  {t("activity.empty")}
                </p>
              ) : (
                items.map((item) => (
                  <div key={item.id} style={{ padding: "10px 14px", borderBottom: `1px solid ${T.lineSoft}` }}>
                    <p
                      style={{
                        margin: 0, fontSize: 12.5, fontWeight: 600, color: T.ink,
                        lineHeight: 1.45, wordBreak: "break-word", overflowWrap: "anywhere",
                      }}
                    >
                      {item.name}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11.5, color: T.inkSoft, fontFamily: fonts.mono, whiteSpace: "nowrap" }}>
                        ₹{item.amount} · {item.period}
                      </span>
                      <span style={{ fontSize: 10.5, color: T.inkFaint, whiteSpace: "nowrap", flexShrink: 0 }}>
                        {item.date ? new Date(item.date).toLocaleDateString() : ""}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
