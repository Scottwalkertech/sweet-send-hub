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
  const [visible, setVisible] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setVisible(true);
    setMsgIdx(0);
    const msgTimer = setInterval(() => {
      setMsgIdx((i) => (i + 1) % MESSAGES.length);
    }, 500);
    const hideTimer = setTimeout(() => {
      setVisible(false);
    }, 1800);
    return () => {
      clearInterval(msgTimer);
      clearTimeout(hideTimer);
    };
  }, [pathname]);

  return (
    <>
      <style>{`
        @keyframes ptl-spin { to { transform: rotate(360deg); } }
        @keyframes ptl-spin-rev { to { transform: rotate(-360deg); } }
        @keyframes ptl-pulse { 0%,100% { opacity:.6; transform:scale(1);} 50%{opacity:1; transform:scale(1.08);} }
        @keyframes ptl-fade { from { opacity:0;} to {opacity:1;} }
        .ptl-overlay {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; align-items: center; justify-content: center;
          background: rgba(10, 15, 30, 0.35);
          backdrop-filter: blur(14px) saturate(140%);
          animation: ptl-fade .25s ease-out;
          transition: opacity .4s ease;
        }
        .ptl-overlay.hide { opacity: 0; pointer-events: none; }
        .ptl-wrap { display:flex; flex-direction:column; align-items:center; gap:1.5rem; }
        .ptl-rings { position: relative; width: 84px; height: 84px; }
        .ptl-ring {
          position:absolute; inset:0; border-radius:9999px;
          border: 3px solid transparent;
          will-change: transform;
        }
        .ptl-ring.outer {
          border-top-color: #d4af37;
          border-right-color: #d4af37;
          animation: ptl-spin 1.1s linear infinite;
          box-shadow: 0 0 24px rgba(212,175,55,.35);
        }
        .ptl-ring.inner {
          inset: 14px;
          border-bottom-color: #7dd3fc;
          border-left-color: #7dd3fc;
          animation: ptl-spin-rev .9s linear infinite;
          box-shadow: 0 0 18px rgba(125,211,252,.35);
        }
        .ptl-core {
          position:absolute; inset: 32px; border-radius:9999px;
          background: radial-gradient(circle at 30% 30%, #d4af37, #8a6d1e);
          animation: ptl-pulse 1.4s ease-in-out infinite;
        }
        .ptl-text {
          font-size: 13px; letter-spacing:.08em; text-transform: uppercase;
          color: rgba(255,255,255,.9);
          font-family: ui-sans-serif, system-ui, sans-serif;
          transition: opacity .4s ease;
          text-shadow: 0 1px 6px rgba(0,0,0,.5);
        }
        .ptl-brand {
          font-size: 11px; color: rgba(212,175,55,.85); letter-spacing:.25em;
          font-weight: 600;
        }
      `}</style>
      <div className={`ptl-overlay ${visible ? "" : "hide"}`} aria-hidden={!visible}>
        <div className="ptl-wrap">
          <div className="ptl-brand">DBW · SECURE</div>
          <div className="ptl-rings">
            <div className="ptl-ring outer" />
            <div className="ptl-ring inner" />
            <div className="ptl-core" />
          </div>
          <div key={msgIdx} className="ptl-text" style={{ animation: "ptl-fade .35s ease-out" }}>
            {MESSAGES[msgIdx]}
          </div>
        </div>
      </div>
    </>
  );
}
