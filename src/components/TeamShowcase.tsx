import { useEffect, useState } from "react";
import type React from "react";
import type { RulesConfig, Team } from "../types";
import { fmt, calcMax, squadFull, byIconThenPrice } from "../utils";
import { ROLE_STYLE } from "../constants";
import { TeamAvatar } from "./TeamAvatar";

/* Projector "team view": cycles through every team's squad — purse, max bid, players bought and
   role mix — so the hall can see where each team stands between players. Turned on from the console. */

export const SHOWCASE_SECS = 9;
const ROLES = ["Batsman", "Bowler", "All-Rounder", "Wicket Keeper"];
let resumeAt = 0;

export function TeamShowcase({ teams, rules, league }: {
  teams: Team[];
  rules: Pick<RulesConfig, "totalPurse" | "minPlayers" | "maxPlayers" | "defaultBasePrice">;
  league: string;
}) {
  // Resume where the rotation left off: the view unmounts while bids are open, and restarting at the
  // first team every time would mean the last teams were hardly ever shown.
  const [idx, setIdx] = useState(() => resumeAt);
  useEffect(() => {
    const t = window.setInterval(() => setIdx(i => (resumeAt = i + 1)), SHOWCASE_SECS * 1000);
    return () => window.clearInterval(t);
  }, []);
  if (!teams.length) return null;
  const k = idx % teams.length;
  const t = teams[k];
  const spent = rules.totalPurse - t.purse;
  const full = squadFull(t, rules);
  const need = Math.max(0, rules.minPlayers - t.players.length);
  const squad = [...t.players].sort(byIconThenPrice);
  const bought = squad.filter(p => !p.icon);
  const topBuy = bought[0];
  const cols = squad.length > 12 ? 3 : 2;
  const maxRows = 8;
  const shown = squad.slice(0, cols * maxRows);
  const roleCount = (r: string) => t.players.filter(p => p.role === r).length;
  const other = t.players.filter(p => !p.icon && !ROLES.includes(p.role)).length;

  const stats: { l: string; v: string; c: string }[] = [
    { l: "Purse left", v: fmt(t.purse), c: "#fff" },
    { l: "Max bid", v: full ? "Squad full" : fmt(calcMax(t, rules.minPlayers, rules.defaultBasePrice)), c: full ? "#ff5f57" : "#f0c040" },
    { l: "Spent", v: fmt(spent), c: "#90a4d4" },
    { l: "Players", v: `${t.players.length}${rules.maxPlayers ? ` / ${rules.maxPlayers}` : ""}`, c: need ? "#90a4d4" : "#30d158" },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <style>{`
        @keyframes tsIn  { 0%{opacity:0; transform:translateX(40px)} 100%{opacity:1; transform:translateX(0)} }
        @keyframes tsBar { from{width:0} to{width:100%} }
        .ts-in{ animation: tsIn .45s ease-out; }
      `}</style>

      {/* Header: league + team dots */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 28px", borderBottom: "1px solid #1a2d50", background: "#07101e" }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#f0c040", letterSpacing: 1 }}>{league} · Team squads</div>
        <div style={{ display: "flex", gap: 8 }}>
          {teams.map((x, i) => (
            <span key={x.name} title={x.name} style={{ width: i === k ? 34 : 12, height: 12, borderRadius: 6, background: i === k ? x.color : `${x.color}55`, transition: "all .3s" }} />
          ))}
        </div>
      </div>

      <div key={idx} className="ts-in" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 22, padding: "28px 40px 20px", borderTop: `6px solid ${t.color}` }}>
        {/* Team name */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <TeamAvatar team={t} size={t.logo ? 120 : 92} border={4} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "clamp(40px, 4.6vw, 72px)", fontWeight: 900, color: t.color, lineHeight: 1.05, textShadow: `0 0 40px ${t.color}55` }}>{t.name}</div>
            {t.owner?.trim() && <div style={{ fontSize: 24, fontWeight: 700, color: "#c0d4f0", marginTop: 6 }}>Owner: {t.owner.trim()}</div>}
            <div style={{ fontSize: 22, fontWeight: 700, color: need ? "#f0a030" : "#30d158", marginTop: 4 }}>
              {full ? "Squad full" : need ? `Needs ${need} more player${need > 1 ? "s" : ""}` : "Minimum squad complete ✓"}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14 }}>
          {stats.map(s => (
            <div key={s.l} style={{ background: "#07101e", border: "1px solid #1a2d50", borderRadius: 14, padding: "14px 18px" }}>
              <div style={{ fontSize: "clamp(26px, 2.6vw, 40px)", fontWeight: 900, color: s.c, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.v}</div>
              <div style={{ fontSize: 15, color: "#4a6080", textTransform: "uppercase", letterSpacing: "1.5px", marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Role mix */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {ROLES.map(r => (
            <span key={r} style={{ ...ROLE_STYLE[r], fontSize: 20, fontWeight: 800, padding: "6px 16px", borderRadius: 24, opacity: roleCount(r) ? 1 : .45 }}>
              {r} · {roleCount(r)}
            </span>
          ))}
          {other > 0 && <span style={{ fontSize: 20, fontWeight: 800, padding: "6px 16px", borderRadius: 24, background: "#1a2d50", color: "#8899bb" }}>Other · {other}</span>}
        </div>

        {/* Squad */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {squad.length === 0 ? (
            <div style={{ fontSize: 28, color: "#4a6080", fontWeight: 700 }}>No players bought yet.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: "8px 28px" }}>
              {shown.map(p => {
                const star = p === topBuy && bought.length > 1;
                return (
                  <div key={p.serialNo} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 14px", borderRadius: 10,
                    background: star ? `${t.color}22` : "#07101e", border: `1px solid ${star ? t.color : "#1a2d50"}`, minWidth: 0 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {star && "⭐ "}{p.name}
                    </span>
                    <span style={{ ...(ROLE_STYLE[p.role] ?? {}), fontSize: 13, fontWeight: 800, padding: "2px 9px", borderRadius: 12, whiteSpace: "nowrap" } as React.CSSProperties}>{p.role}</span>
                    {p.icon
                      ? <span style={{ fontSize: 16, fontWeight: 900, color: "#050a14", background: "#f0c040", padding: "3px 10px", borderRadius: 12, letterSpacing: 1 }}>ICON</span>
                      : <span style={{ fontSize: 22, fontWeight: 900, color: "#f0c040", whiteSpace: "nowrap" }}>{fmt(p.soldPrice ?? p.currentBid)}</span>}
                  </div>
                );
              })}
            </div>
          )}
          {squad.length > shown.length && <div style={{ fontSize: 18, color: "#6a80aa", marginTop: 8 }}>+{squad.length - shown.length} more</div>}
        </div>
      </div>

      {/* Time until the next team */}
      <div style={{ height: 5, background: "#0a1528" }}>
        <div key={idx} style={{ height: "100%", background: t.color, animation: `tsBar ${SHOWCASE_SECS}s linear forwards` }} />
      </div>
    </div>
  );
}
