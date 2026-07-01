import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

const MESSAGES = [
  "Securing connection...",
  "Verifying session...",
  "Fetching account data...",
  "Finalizing secure handshake...",
];

export function PageTransitionLoader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const firstRender = useRef(true);
  const timersRef = useRef<{ msg?: ReturnType<typeof setInterval>; hide?: ReturnType<typeof setTimeout> }>({});

  const trigger = () => {
    setIsGlobalLoading(true);
    setMsgIdx(0);
    if (timersRef.current.msg) clearInterval(timersRef.current.msg);
    if (timersRef.current.hide) clearTimeout(timersRef.current.hide);
    timersRef.current.msg = setInterval(() => {
      setMsgIdx((i) => (i + 1) % MESSAGES.length);
    }, 480);
    timersRef.current.hide = setTimeout(() => {
      setIsGlobalLoading(false);
    }, 1800);
  };

  // Fire on route path changes
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    trigger();
    return () => {
      if (timersRef.current.msg) clearInterval(timersRef.current.msg);
      if (timersRef.current.hide) clearTimeout(timersRef.current.hide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Fire on internal view-change events + intercept nav clicks (in-app SPA views
  // that don't change the URL still get the loading simulation).
  useEffect(() => {
    const onForce = () => trigger();
    const events = [
      "ptl:show",
      "mt:view-profile",
      "mt:view-card",
      "mt:open-routing",
      "mt:open-chat",
      "mt:segment-change",
      "mt:open-account",
      "mt:back-dashboard",
    ];
    events.forEach((n) => window.addEventListener(n, onForce));

    const clickHandler = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Any anchor or element explicitly marked as navigational
      const navEl = target.closest<HTMLElement>("a[href], [data-nav], [data-loader]");
      if (!navEl) return;
      if (navEl.tagName === "A") {
        const a = navEl as HTMLAnchorElement;
        if (!a.href || a.target === "_blank") return;
        const href = a.getAttribute("href") || "";
        if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      }
      trigger();
    };
    document.addEventListener("click", clickHandler, true);

    return () => {
      events.forEach((n) => window.removeEventListener(n, onForce));
      document.removeEventListener("click", clickHandler, true);
    };
  }, []);


  if (!isGlobalLoading) return null;

  return (
    <>
      <style>{`
        @keyframes ptl-spin { to { transform: rotate(360deg); } }
        @keyframes ptl-spin-rev { to { transform: rotate(-360deg); } }
        @keyframes ptl-pulse { 0%,100% { opacity:.7; transform:scale(1);} 50%{opacity:1; transform:scale(1.1);} }
        @keyframes ptl-fade-in { from { opacity:0;} to {opacity:1;} }
        @keyframes ptl-text-fade { 0%{opacity:0; transform:translateY(4px);} 100%{opacity:1; transform:translateY(0);} }
        .ptl-overlay {
          position: fixed; inset: 0; z-index: 2147483000;
          display: flex; align-items: center; justify-content: center;
          background: rgba(8, 12, 28, 0.55);
          backdrop-filter: blur(16px) saturate(150%);
          animation: ptl-fade-in .25s ease-out;
        }
        .ptl-wrap { display:flex; flex-direction:column; align-items:center; gap:1.4rem; }
        .ptl-rings { position: relative; width: 92px; height: 92px; }
        .ptl-ring {
          position:absolute; inset:0; border-radius:9999px;
          border: 3px solid transparent;
          will-change: transform;
        }
        .ptl-ring.outer {
          border-top-color: #d4af37;
          border-right-color: #d4af37;
          animation: ptl-spin 1.1s linear infinite;
          box-shadow: 0 0 26px rgba(212,175,55,.4);
        }
        .ptl-ring.inner {
          inset: 15px;
          border-bottom-color: #7dd3fc;
          border-left-color: #7dd3fc;
          animation: ptl-spin-rev .9s linear infinite;
          box-shadow: 0 0 20px rgba(125,211,252,.4);
        }
        .ptl-core {
          position:absolute; inset: 34px; border-radius:9999px;
          background: radial-gradient(circle at 30% 30%, #f5cd5b, #8a6d1e);
          animation: ptl-pulse 1.4s ease-in-out infinite;
        }
        .ptl-text {
          font-size: 13px; letter-spacing:.1em; text-transform: uppercase;
          color: rgba(255,255,255,.92);
          font-family: ui-sans-serif, system-ui, sans-serif;
          text-shadow: 0 1px 6px rgba(0,0,0,.5);
          animation: ptl-text-fade .35s ease-out;
        }
        .ptl-brand {
          font-size: 11px; color: rgba(212,175,55,.9); letter-spacing:.3em;
          font-weight: 700;
        }
      `}</style>
      <div className="ptl-overlay" role="status" aria-live="polite">
        <div className="ptl-wrap">
          <div className="ptl-brand">DBW · SECURE</div>
          <div className="ptl-rings">
            <div className="ptl-ring outer" />
            <div className="ptl-ring inner" />
            <div className="ptl-core" />
          </div>
          <div key={msgIdx} className="ptl-text">
            {MESSAGES[msgIdx]}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Intercepts in-page navigation clicks so the loader always shows,
 * even when TanStack Router client-navigates to the same-origin route
 * quickly enough that the overlay would otherwise flash imperceptibly.
 */
export function useInterceptNavigationClicks() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank") return;
      try {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname) return;
      } catch {
        return;
      }
      window.dispatchEvent(new CustomEvent("ptl:force-show"));
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);
}
