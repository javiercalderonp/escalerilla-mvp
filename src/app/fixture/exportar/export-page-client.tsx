"use client";

import { toPng } from "html-to-image";
import { Download, Printer, Share2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

type ExportMatch = {
  id: string;
  category: "M" | "F";
  player1Name: string;
  player2Name: string;
  player1Id: string;
  player2Id: string;
  winnerId: string | null;
  status: string;
  type: "sorteo" | "desafio" | "campeonato";
  playedOn: string | null;
  sets: { setNumber: number; gamesP1: number; gamesP2: number }[];
};

type DayGroup = {
  key: string;
  label: string;
  matchesM: ExportMatch[];
  matchesF: ExportMatch[];
};

type Props = {
  type: "proximos" | "resultados";
  title: string;
  subtitle: string;
  dateRange: string;
  groups: DayGroup[];
  generatedAt: string;
};

function getTypeLabel(type: ExportMatch["type"]) {
  if (type === "desafio") return "Desafío";
  if (type === "campeonato") return "Campeonato";
  return "Sorteo";
}

function formatScore(match: ExportMatch) {
  if (match.status === "wo") {
    const loser =
      match.winnerId === match.player1Id
        ? match.player2Name
        : match.player1Name;
    return `W.O. (${loser})`;
  }
  if (match.status === "empate") return "Empate";
  if (match.sets.length === 0) return null;

  return match.sets
    .map((set) => `${set.gamesP1}-${set.gamesP2}`)
    .join(" ");
}

function MatchCard({
  match,
  showScore,
}: {
  match: ExportMatch;
  showScore: boolean;
}) {
  const score = showScore ? formatScore(match) : null;
  const p1Won = match.winnerId === match.player1Id;
  const p2Won = match.winnerId === match.player2Id;

  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid #ded6ca",
        overflow: "hidden",
        background: "#ffffff",
      }}
    >
      {/* Card header */}
      <div
        style={{
          background: "#0d1b2a",
          padding: "6px 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: match.type === "desafio" ? "#b04d15" : "rgba(255,255,255,0.5)",
          }}
        >
          {getTypeLabel(match.type)}
        </span>
        {score ? (
          <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
            {score}
          </span>
        ) : null}
      </div>

      {/* Players */}
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: showScore ? (p1Won ? 700 : 400) : 600,
              color: showScore && !p1Won && match.winnerId ? "#776f66" : "#0d1b2a",
            }}
          >
            {match.player1Name}
          </span>
          {showScore && p1Won && (
            <span style={{ fontSize: 10, color: "#4a8c5e", fontWeight: 700 }}>✓</span>
          )}
        </div>
        <div style={{ height: 1, background: "#ded6ca" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: showScore ? (p2Won ? 700 : 400) : 600,
              color: showScore && !p2Won && match.winnerId ? "#776f66" : "#0d1b2a",
            }}
          >
            {match.player2Name}
          </span>
          {showScore && p2Won && (
            <span style={{ fontSize: 10, color: "#4a8c5e", fontWeight: 700 }}>✓</span>
          )}
        </div>
      </div>
    </div>
  );
}

function CategorySection({
  label,
  matches,
  showScore,
}: {
  label: string;
  matches: ExportMatch[];
  showScore: boolean;
}) {
  if (matches.length === 0) return null;

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#776f66",
          }}
        >
          {label}
        </span>
        <div style={{ flex: 1, height: 1, background: "#ded6ca" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} showScore={showScore} />
        ))}
      </div>
    </div>
  );
}

export function ExportPageClient({
  type,
  title,
  subtitle,
  dateRange,
  groups,
  generatedAt,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const showScore = type === "resultados";

  async function handleDownloadPng() {
    if (!contentRef.current) return;
    setIsCapturing(true);
    try {
      const dataUrl = await toPng(contentRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#f6f2ea",
      });
      const link = document.createElement("a");
      link.download = `escalerilla-${type}-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Error generando PNG:", err);
    } finally {
      setIsCapturing(false);
    }
  }

  async function handleShare() {
    if (!contentRef.current) return;
    setIsCapturing(true);
    try {
      const dataUrl = await toPng(contentRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#f6f2ea",
      });
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const file = new File(
        [blob],
        `escalerilla-${type}-${new Date().toISOString().slice(0, 10)}.png`,
        { type: "image/png" },
      );
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title });
      } else if (navigator.share) {
        await navigator.share({ title, url: window.location.href });
      } else {
        await handleDownloadPng();
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Error compartiendo:", err);
      }
    } finally {
      setIsCapturing(false);
    }
  }

  const totalMatches = groups.reduce(
    (acc, g) => acc + g.matchesM.length + g.matchesF.length,
    0,
  );

  return (
    <main className="min-h-screen bg-background text-foreground print:bg-white">
      {/* Action bar — hidden when printing */}
      <div className="export-no-print sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card px-4 py-3 shadow-sm print:hidden">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{dateRange}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
          >
            <Printer className="size-3.5" />
            PDF
          </button>
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={isCapturing}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            <Download className="size-3.5" />
            {isCapturing ? "Generando…" : "PNG"}
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={isCapturing}
            className="flex items-center gap-1.5 rounded-lg bg-[#0d1b2a] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            <Share2 className="size-3.5" />
            Compartir
          </button>
        </div>
      </div>

      {/* Exportable content */}
      <div className="flex justify-center px-4 py-6 print:px-0 print:py-0">
        <div
          ref={contentRef}
          style={{
            width: 600,
            maxWidth: "100%",
            fontFamily: "system-ui, -apple-system, sans-serif",
            background: "#f6f2ea",
            borderRadius: 20,
            overflow: "hidden",
            padding: 0,
          }}
        >
          {/* Header */}
          <div
            style={{
              background: "linear-gradient(140deg, #0b1d4f 0%, #1640a0 55%, #0d2460 100%)",
              padding: "28px 24px 24px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Grid overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.07,
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <Image
                src="/logo.png"
                alt="Escalerilla La Dehesa"
                width={52}
                height={52}
                style={{ borderRadius: 10, flexShrink: 0 }}
                unoptimized
              />
              <div>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(147,197,253,0.8)",
                    margin: 0,
                  }}
                >
                  Escalerilla · Club La Dehesa
                </p>
                <h1
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#ffffff",
                    margin: "4px 0 0",
                    lineHeight: 1.2,
                  }}
                >
                  {title}
                </h1>
              </div>
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.1)",
                borderRadius: 10,
                padding: "8px 14px",
                display: "inline-block",
              }}
            >
              <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>
                {subtitle}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                {totalMatches} {totalMatches === 1 ? "partido" : "partidos"}
              </p>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
            {groups.length === 0 ? (
              <div
                style={{
                  padding: "40px 20px",
                  textAlign: "center",
                  color: "#776f66",
                  fontSize: 14,
                }}
              >
                {type === "proximos"
                  ? "No hay partidos programados para los próximos 8 días."
                  : "No hay resultados registrados en los últimos 8 días."}
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.key}>
                  {/* Day/week heading */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        background: "#0d1b2a",
                        borderRadius: 8,
                        padding: "4px 10px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#ffffff",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {group.label}
                      </span>
                    </div>
                    <div style={{ flex: 1, height: 1, background: "#ded6ca" }} />
                  </div>

                  <CategorySection
                    label="Hombres"
                    matches={group.matchesM}
                    showScore={showScore}
                  />
                  <CategorySection
                    label="Mujeres"
                    matches={group.matchesF}
                    showScore={showScore}
                  />
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              borderTop: "1px solid #ded6ca",
              padding: "12px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 10, color: "#776f66", fontWeight: 600 }}>
              escalerilla.cl
            </span>
            <span style={{ fontSize: 10, color: "#776f66" }}>{generatedAt}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
