"use client";

import { toPng } from "html-to-image";
import { Download, Printer, Share2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import type { DayGroup, ExportMatch } from "@/app/fixture/exportar/page";

type Props = {
  type: "proximos" | "resultados";
  title: string;
  subtitle: string;
  dateRange: string;
  groups: DayGroup[];
  generatedAt: string;
};

const NAVY = "#0d1b2a";
const NAVY_HEADER = "#111d2e";
const GREEN = "#3d8b57";
const MUTED = "#776f66";
const BORDER = "#ded6ca";
const CARD_BG = "#ffffff";
const PAGE_BG = "#f6f2ea";

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatPoints(pts: number) {
  if (pts > 0) return `+${pts} pts`;
  if (pts < 0) return `${pts} pts`;
  return "0 pts";
}

function formatShortDate(dateStr: string | null) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function getTypeLabel(type: ExportMatch["type"]) {
  if (type === "desafio") return "Desafío";
  if (type === "campeonato") return "Campeonato";
  return null;
}

function PlayerRow({
  name,
  rankingPosition,
  points,
  isWinner,
  hasWinner,
  sets,
  playerIndex,
  showScore,
}: {
  name: string;
  rankingPosition: number | null;
  points: number | null;
  isWinner: boolean;
  hasWinner: boolean;
  sets: ExportMatch["sets"];
  playerIndex: 1 | 2;
  showScore: boolean;
}) {
  const isLoser = hasWinner && !isWinner;
  const initials = getInitials(name);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
      }}
    >
      {/* Status dot */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          flexShrink: 0,
          background: isWinner ? NAVY : "transparent",
          border: isWinner ? "none" : `2px solid ${BORDER}`,
        }}
      />

      {/* Ranking */}
      <span
        style={{
          width: 32,
          flexShrink: 0,
          fontSize: 11,
          fontWeight: 600,
          color: MUTED,
          textAlign: "center",
        }}
      >
        {rankingPosition ? `#${rankingPosition}` : "—"}
      </span>

      {/* Avatar */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          background: isWinner ? NAVY : "#ede5d8",
          color: isWinner ? "#ffffff" : MUTED,
        }}
      >
        {initials}
      </div>

      {/* Name + points */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: isLoser ? 400 : 600,
            color: isLoser ? MUTED : NAVY,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: 1.3,
          }}
        >
          {name}
        </p>
        {points !== null && (
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 500,
              color:
                points > 0 ? GREEN : points < 0 ? "#c0392b" : MUTED,
              lineHeight: 1.2,
            }}
          >
            {formatPoints(points)}
          </p>
        )}
      </div>

      {/* Winner check */}
      {isWinner ? (
        <span style={{ fontSize: 12, color: GREEN, fontWeight: 700, flexShrink: 0, marginRight: 4 }}>
          ✓
        </span>
      ) : hasWinner ? (
        <span style={{ width: 20, flexShrink: 0 }} />
      ) : null}

      {/* Set scores */}
      {showScore && (
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          {sets.length > 0 ? (
            sets.map((set) => {
              const playerGames =
                playerIndex === 1 ? set.gamesP1 : set.gamesP2;
              const opponentGames =
                playerIndex === 1 ? set.gamesP2 : set.gamesP1;
              const wonSet = playerGames > opponentGames;

              return (
                <span
                  key={set.setNumber}
                  style={{
                    width: 16,
                    textAlign: "center",
                    fontSize: 13,
                    fontWeight: wonSet ? 700 : 400,
                    color: wonSet ? NAVY : MUTED,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {playerGames}
                </span>
              );
            })
          ) : (
            <span style={{ fontSize: 13, color: MUTED }}>—</span>
          )}
        </div>
      )}
    </div>
  );
}

function MatchCard({
  match,
  showScore,
}: {
  match: ExportMatch;
  showScore: boolean;
}) {
  const hasWinner = match.winnerId !== null;
  const dateLabel =
    match.playedOn ? formatShortDate(match.playedOn) : null;
  const typeLabel = getTypeLabel(match.type);

  return (
    <div
      style={{
        borderRadius: 14,
        overflow: "hidden",
        border: `1px solid ${BORDER}`,
        background: CARD_BG,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {/* Dark header */}
      <div
        style={{
          background: NAVY_HEADER,
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 500, flex: 1 }}>
          {dateLabel ?? (match.weekStartsOn ? `Semana ${formatShortDate(match.weekStartsOn)}` : "")}
          {typeLabel ? (
            <span style={{ marginLeft: 8, color: match.type === "desafio" ? "#d96a2b" : "rgba(255,255,255,0.5)" }}>
              · {typeLabel}
            </span>
          ) : null}
        </span>
      </div>

      {/* Player 1 */}
      <PlayerRow
        name={match.player1Name}
        rankingPosition={match.player1RankingPosition}
        points={match.player1Points}
        isWinner={match.winnerId === match.player1Id}
        hasWinner={hasWinner}
        sets={match.sets}
        playerIndex={1}
        showScore={showScore}
      />

      {/* Divider */}
      <div style={{ height: 1, background: BORDER, margin: "0 14px" }} />

      {/* Player 2 */}
      <PlayerRow
        name={match.player2Name}
        rankingPosition={match.player2RankingPosition}
        points={match.player2Points}
        isWinner={match.winnerId === match.player2Id}
        hasWinner={hasWinner}
        sets={match.sets}
        playerIndex={2}
        showScore={showScore}
      />
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
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: MUTED,
            flexShrink: 0,
          }}
        >
          {label}
        </span>
        <div style={{ flex: 1, height: 1, background: BORDER }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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

  async function captureImage() {
    if (!contentRef.current) return null;
    return toPng(contentRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: PAGE_BG,
    });
  }

  async function handleDownloadPng() {
    setIsCapturing(true);
    try {
      const dataUrl = await captureImage();
      if (!dataUrl) return;
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
    setIsCapturing(true);
    try {
      const dataUrl = await captureImage();
      if (!dataUrl) return;
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
      {/* Action bar */}
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
            width: 580,
            maxWidth: "100%",
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
            background: PAGE_BG,
            borderRadius: 20,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              background:
                "linear-gradient(140deg, #0b1d4f 0%, #1640a0 55%, #0d2460 100%)",
              padding: "24px 22px 22px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Subtle grid overlay */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.06,
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 16,
              }}
            >
              <Image
                src="/logo.png"
                alt="Logo"
                width={48}
                height={48}
                unoptimized
                style={{ borderRadius: 10, flexShrink: 0 }}
              />
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(147,197,253,0.8)",
                  }}
                >
                  Escalerilla · Club La Dehesa
                </p>
                <h1
                  style={{
                    margin: "3px 0 0",
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#ffffff",
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
                borderRadius: 8,
                padding: "7px 12px",
                display: "inline-block",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.85)",
                  fontWeight: 500,
                }}
              >
                {subtitle}
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 10,
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                {totalMatches} {totalMatches === 1 ? "partido" : "partidos"}
              </p>
            </div>
          </div>

          {/* Body */}
          <div
            style={{
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            {groups.length === 0 ? (
              <div
                style={{
                  padding: "40px 20px",
                  textAlign: "center",
                  color: MUTED,
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
                  {/* Group heading */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        background: NAVY,
                        borderRadius: 6,
                        padding: "4px 10px",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#ffffff",
                          textTransform: "uppercase",
                          letterSpacing: "0.07em",
                        }}
                      >
                        {group.label}
                      </span>
                    </div>
                    <div
                      style={{ flex: 1, height: 1, background: BORDER }}
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
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
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              borderTop: `1px solid ${BORDER}`,
              padding: "10px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}
            >
              escalerilla.cl
            </span>
            <span style={{ fontSize: 10, color: MUTED }}>
              {generatedAt}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
