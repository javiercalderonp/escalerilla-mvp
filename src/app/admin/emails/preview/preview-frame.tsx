"use client";

import { useEffect, useRef, useState } from "react";

type PreviewMode = "desktop" | "mobile";

export function PreviewFrame({ html, label }: { html: string; label: string }) {
  const [mode, setMode] = useState<PreviewMode>("desktop");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fitIframe = () => {
    const iframe = iframeRef.current;
    const body = iframe?.contentDocument?.body;
    if (!body) return;
    iframe.style.height = `${body.scrollHeight}px`;
  };

  useEffect(() => {
    fitIframe();
  }, [mode]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Vista:</span>
        <button
          onClick={() => setMode("desktop")}
          className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
            mode === "desktop"
              ? "bg-slate-950 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}
        >
          Desktop
        </button>
        <button
          onClick={() => setMode("mobile")}
          className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
            mode === "mobile"
              ? "bg-slate-950 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}
        >
          Mobile
        </button>
        {mode === "mobile" && (
          <span className="text-xs text-slate-400">390px</span>
        )}
      </div>
      <div
        className={`rounded-lg border border-slate-200 ${
          mode === "mobile" ? "flex justify-center bg-slate-100 p-6" : "bg-white"
        }`}
      >
        <iframe
          ref={iframeRef}
          title={`Preview ${label}`}
          srcDoc={html}
          className="min-h-96 bg-white"
          style={{ width: mode === "desktop" ? "100%" : "390px" }}
          onLoad={fitIframe}
        />
      </div>
    </div>
  );
}
