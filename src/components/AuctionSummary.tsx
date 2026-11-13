import type React from "react";
import type { AuctionConfig, Player, Team } from "../types";
import { fmt } from "../utils";

/* End-of-auction summary: headline numbers, highlights and every squad side by side.
   Used on the console (#summary, downloadable as an image) and on the projector. */

const initials = (name: string) => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
const ROLE_SHORT: Record<string, string> = { "Batsman":"BAT", "Bowler":"BOWL", "All-Rounder":"AR", "Wicket Keeper":"WK" };

export function AuctionSummary({ config, players, teams, projector = false, innerRef }: {
  config: AuctionConfig;
  players: Player[];
  teams: Team[];
  /** Big type, no scrolling: squads are cut to fit and show "+N more". */
  projector?: boolean;
  innerRef?: React.Ref<HTMLDivElement>;
}) {
  const { totalPurse } = config.rules;
  const sold = players.filter(p => p.status === "sold" && p.soldPrice !== undefined);
  const unsold = players.filter(p => p.status === "unsold").length;
  const available = players.filter(p => p.status === "available").length;
  const spent = sold.reduce((a, p) => a + (p.soldPrice ?? 0), 0);
  const teamColor = (name?: string) => teams.find(t => t.name === name)?.color ?? "#90a4d4";

  const priciest = sold.length ? sold.reduce((a, b) => (b.soldPrice! > a.soldPrice! ? b : a)) : null;
  const withBase = sold.filter(p => p.basePrice > 0);
  const jump = withBase.length ? withBase.reduce((a, b) => (b.soldPrice! / b.basePrice > a.soldPrice! / a.basePrice ? b : a)) : null;
  const teamSpent = (t: Team) => totalPurse - t.purse;
  const spender = teams.length ? teams.reduce((a, b) => (teamSpent(b) > teamSpent(a) ? b : a)) : null;
  const saver = teams.length ? teams.reduce((a, b) => (b.purse > a.purse ? b : a)) : null;

  const s = projector ? 1.25 : 1;   // type scale
  const px = (n: number) => Math.round(n * s);
  const cols = projector ? Math.min(teams.length, teams.length > 6 ? 4 : teams.length > 4 ? 3 : teams.length) : Math.min(teams.length, 4);
  const rowsPerTeam = projector ? (teams.length > cols ? 5 : 11) : Infinity;

  const highlights: { icon: string; label: string; main: string; sub: string; color: string }[] = [];
  if (priciest) highlights.push({ icon:"💰", label:"Most expensive", main:priciest.name, sub:`${fmt(priciest.soldPrice!)} · ${priciest.soldTo}`, color:teamColor(priciest.soldTo) });
  if (jump && jump.soldPrice! > jump.basePrice) {
    const x = jump.soldPrice! / jump.basePrice;
    highlights.push({ icon:"🚀", label:"Biggest jump", main:jump.name, sub:`${x >= 10 ? Math.round(x) : x.toFixed(1)}× base · ${fmt(jump.basePrice)} → ${fmt(jump.soldPrice!)}`, color:teamColor(jump.soldTo) });
  }
  if (spender && teamSpent(spender) > 0) highlights.push({ icon:"🏦", label:"Biggest spender", main:spender.name, sub:`${fmt(teamSpent(spender))} on ${spender.players.length} players`, color:spender.color });
  if (saver && sold.length) highlights.push({ icon:"🪙", label:"Most purse left", main:saver.name, sub:`${fmt(saver.purse)} left`, color:saver.color });

  return (
    <div ref={innerRef} style={{ background:"#030710", color:"#fff", padding: projector ? "20px 28px" : "20px 22px", display:"flex", flexDirection:"column", gap: px(16),
      height: projector ? "100%" : undefined, overflow: projector ? "hidden" : undefined, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* Title + headline numbers */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          {config.league.logo && <img src={config.league.logo} alt="" style={{ height:px(52), width:px(52), objectFit:"contain", borderRadius:10 }} onError={e => (e.currentTarget.style.display = "none")} />}
          <div>
            <div style={{ fontSize:px(26), fontWeight:900, color:"#f0c040", lineHeight:1.1 }}>{config.league.name} {config.league.year}</div>
            <div style={{ fontSize:px(14), color:"#6a80aa", letterSpacing:"2px", textTransform:"uppercase" }}>🏆 Auction summary</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:px(28), flexWrap:"wrap" }}>
          {[
            { l:"Sold",        v:String(sold.length),                                   c:"#30d158" },
            { l:"Unsold",      v:String(unsold),                                        c:"#ff5f57" },
            ...(available ? [{ l:"Still to go", v:String(available), c:"#f0c040" }] : []),
            { l:"Total spent", v:fmt(spent),                                            c:"#f0c040" },
            { l:"Avg price",   v:sold.length ? fmt(Math.round(spent / sold.length)) : "—", c:"#90a4d4" },
          ].map(x => (
            <div key={x.l} style={{ textAlign:"center" }}>
              <div style={{ fontSize:px(26), fontWeight:900, color:x.c, lineHeight:1 }}>{x.v}</div>
              <div style={{ fontSize:px(11), color:"#4a6080", textTransform:"uppercase", letterSpacing:"1px", marginTop:3 }}>{x.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Highlights */}
      {highlights.length > 0 ? (
        <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(${px(220)}px, 1fr))`, gap:12 }}>
          {highlights.map(h => (
            <div key={h.label} style={{ background:"#07101e", border:`1px solid ${h.color}55`, borderLeft:`4px solid ${h.color}`, borderRadius:12, padding:"12px 16px", minWidth:0 }}>
              <div style={{ fontSize:px(12), color:"#6a80aa", textTransform:"uppercase", letterSpacing:"1.2px", fontWeight:700 }}>{h.icon} {h.label}</div>
              <div style={{ fontSize:px(20), fontWeight:900, color:h.color, marginTop:4, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{h.main}</div>
              <div style={{ fontSize:px(14), color:"#c0d4f0", marginTop:2 }}>{h.sub}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding:20, textAlign:"center", color:"#4a6080", fontSize:px(18), background:"#07101e", border:"1px solid #1a2d50", borderRadius:12 }}>No players sold yet.</div>
      )}

      {/* Squads side by side */}
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.max(cols, 1)}, minmax(0, 1fr))`, gap:12, flex: projector ? 1 : undefined, minHeight:0 }}>
        {teams.map(t => {
          const squad = [...t.players].sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0));
          const shown = squad.slice(0, rowsPerTeam);
          return (
            <div key={t.name} style={{ background:"#07101e", border:"1px solid #1a2d50", borderTop:`4px solid ${t.color}`, borderRadius:12, padding:"12px 14px", minWidth:0, overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:px(34), height:px(34), borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
                  background:`${t.color}33`, border:`2px solid ${t.color}`, color:t.color, fontWeight:900, fontSize:px(13) }}>{initials(t.name)}</div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:px(17), fontWeight:900, color:t.color, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.name}</div>
                  <div style={{ fontSize:px(12), color:"#6a80aa" }}>{t.players.length} players · spent {fmt(teamSpent(t))} · left {fmt(t.purse)}</div>
                </div>
              </div>
              <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:px(4) }}>
                {shown.length === 0 && <div style={{ fontSize:px(13), color:"#4a6080" }}>No players bought</div>}
                {shown.map((pl, k) => (
                  <div key={pl.serialNo} style={{ display:"flex", alignItems:"baseline", gap:8, fontSize:px(14) }}>
                    <span style={{ flex:1, minWidth:0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", fontWeight: k === 0 ? 800 : 600, color: k === 0 ? "#fff" : "#c0d4f0" }}>
                      {k === 0 && "⭐ "}{pl.name}
                    </span>
                    <span style={{ fontSize:px(11), color:"#4a6080", fontWeight:700 }}>{ROLE_SHORT[pl.role] ?? ""}</span>
                    <span style={{ fontWeight:800, color:"#f0c040", whiteSpace:"nowrap" }}>{fmt(pl.soldPrice ?? 0)}</span>
                  </div>
                ))}
                {squad.length > shown.length && <div style={{ fontSize:px(12), color:"#4a6080" }}>+{squad.length - shown.length} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
