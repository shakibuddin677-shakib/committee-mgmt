import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { Globe, Check } from "lucide-react";
import { languages, translations } from "./translations";
import { T, fonts } from "../styles/tokens";

const STORAGE_KEY = "committee_app_lang";
const I18nContext = createContext(null);

function detectInitialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && translations[saved]) return saved;
  } catch {
    // localStorage unavailable (private mode etc.) — fall through
  }
  return "en";
}

// Fills {placeholder} tokens in a translated string, e.g.
// interpolate("{count} member{plural}", { count: 3, plural: "s" })
function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectInitialLang);

  const meta = languages.find((l) => l.code === lang) || languages[0];

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = meta.dir;
  }, [lang, meta.dir]);

  const setLang = (code) => {
    if (!translations[code]) return;
    setLangState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // ignore write failures
    }
  };

  const t = useMemo(() => {
    return (key, vars) => {
      const dict = translations[lang] || translations.en;
      const raw = dict[key] ?? translations.en[key] ?? key;
      return interpolate(raw, vars);
    };
  }, [lang]);

  const value = { lang, setLang, t, dir: meta.dir, languages };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}

// Small reusable switcher — a globe icon that opens a dropdown of
// languages. `tone` = "light" for use on dark backgrounds (sidebar),
// "dark" for use on light backgrounds (topbars, auth screens).
export function LanguageSwitcher({ tone = "dark", align = "left" }) {
  const { lang, setLang, languages: langs } = useI18n();
  const [open, setOpen] = useState(false);

  const isLight = tone === "light";

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="icon-btn"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: isLight ? "rgba(244,239,224,0.08)" : T.surface,
          border: `1px solid ${isLight ? "rgba(244,239,224,0.25)" : T.line}`,
          color: isLight ? T.paper : T.green,
          borderRadius: 8,
          padding: "7px 11px",
          fontSize: 12.5,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <Globe size={14} />
        {langs.find((l) => l.code === lang)?.nativeLabel}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 49 }} />
          <div
            className="pop-in"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              [align]: 0,
              zIndex: 50,
              background: T.surfaceRaised,
              border: `1px solid ${T.line}`,
              borderRadius: 10,
              boxShadow: T.shadowLg,
              overflow: "hidden",
              minWidth: 140,
            }}
          >
            {langs.map((l) => (
              <button
                key={l.code}
                onClick={() => {
                  setLang(l.code);
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  width: "100%",
                  padding: "9px 13px",
                  border: "none",
                  background: l.code === lang ? T.greenTint : "transparent",
                  color: T.ink,
                  fontSize: 13,
                  fontWeight: l.code === lang ? 700 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: fonts.body,
                }}
              >
                {l.nativeLabel}
                {l.code === lang && <Check size={13} color={T.green} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
