import type { AuctionConfig } from "../types";
import { fmt, callSecs } from "../utils";

/* Step 5: Review */
export function Step5Review({ cfg, playerCount }: { cfg: AuctionConfig; playerCount: number }) {
  const rows = [
    { label: "League",       value: `${cfg.league.name} ${cfg.league.year}` },
    { label: "Teams",        value: `${cfg.teams.length} teams` },
    { label: "Players",      value: playerCount > 0 ? `${playerCount} players loaded` : "⚠ No players loaded (go back to Step 4)" },
    { label: "Purse / team", value: fmt(cfg.rules.totalPurse) },
    { label: "Squad size",   value: `min ${cfg.rules.minPlayers}${cfg.rules.maxPlayers ? `, max ${cfg.rules.maxPlayers}` : ", no max"}` },
    { label: "Bid step",     value: [fmt(cfg.rules.bidStep), ...[...(cfg.rules.bidTiers ?? [])].filter(t=>t.step>0).sort((a,b)=>a.from-b.from).map(t => `${fmt(t.step)} from ${fmt(t.from)}`)].join(" → ") },
    { label: "Going once/twice", value: callSecs(cfg.rules) ? `${callSecs(cfg.rules)}s each, then SOLD` : "Manual — press G for once, twice, SOLD" },
    { label: "Base price",   value: fmt(cfg.rules.defaultBasePrice) },
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0, background:"#07101e", border:"1px solid #1a2d50", borderRadius:12, overflow:"hidden" }}>
      {rows.map(({ label, value }, i) => (
        <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"14px 18px", borderBottom: i<rows.length-1?"1px solid #111f3a":"none",
          background: i%2===0?"transparent":"#06101e" }}>
          <span style={{ color:"#6a80aa", fontSize:15 }}>{label}</span>
          <span style={{ color: value.startsWith("⚠")?"#ff9800":"#fff", fontWeight:700, fontSize:15 }}>{value}</span>
        </div>
      ))}
      <div style={{ padding:"12px 18px", borderTop:"1px solid #1a2d50" }}>
        <div style={{ fontSize:13, color:"#4a6080", marginBottom:8 }}>Teams</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {cfg.teams.map(t => (
            <div key={t.name} style={{ display:"flex", alignItems:"center", gap:6, background:"#0c1830", border:"1px solid #1a2d50", borderRadius:20, padding:"4px 12px" }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:t.color }} />
              <span style={{ fontSize:14, color:"#fff", fontWeight:600 }}>{t.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
