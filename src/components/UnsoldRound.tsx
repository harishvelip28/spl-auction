import { useState } from "react";
import type React from "react";
import type { Player, RulesConfig } from "../types";
import { fmt } from "../utils";

/* Bring unsold players back for another round, optionally at a lower base price.
   Prices never go below the league's default base price (the minimum a player can start at). */

type Mode = "keep" | "percent" | "fixed";
export interface UnsoldChange { idx: number; base: number; }

export function UnsoldRound({ players, rules, onStart, onClose }: {
  players: Player[];
  rules: RulesConfig;
  onStart: (changes: UnsoldChange[]) => void;
  onClose: () => void;
}) {
  const unsold = players.map((p, idx) => ({ p, idx })).filter(x => x.p.status === "unsold");
  const [picked, setPicked] = useState<Set<number>>(() => new Set(unsold.map(x => x.idx)));
  const [mode, setMode] = useState<Mode>("percent");
  const [pct, setPct] = useState(50);
  const [fixed, setFixed] = useState(rules.defaultBasePrice);
  const min = rules.defaultBasePrice;

  const newBase = (p: Player) => {
    if (mode === "keep") return p.basePrice;
    const raw = mode === "percent" ? p.basePrice * (1 - pct / 100) : fixed;
    const step = rules.bidStep > 0 ? rules.bidStep : 1;
    return Math.min(p.basePrice, Math.max(min, Math.floor(raw / step) * step));   // never raise, never below the minimum
  };
  const toggle = (i: number) => setPicked(s => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const allOn = picked.size === unsold.length;
  const chosen = unsold.filter(x => picked.has(x.idx));
  const atMin = mode !== "keep" && chosen.some(x => x.p.basePrice > min && newBase(x.p) === min);

  const radio = (m: Mode, label: React.ReactNode) => (
    <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:15, color: mode === m ? "#fff" : "#90a4d4", flexWrap:"wrap" }}>
      <input type="radio" name="unsold-mode" checked={mode === m} onChange={() => setMode(m)} style={{ accentColor:"#f0c040" }} />
      {label}
    </label>
  );
  const num: React.CSSProperties = { width:90, background:"#0a1428", border:"1px solid #1a2d50", borderRadius:7, padding:"5px 8px", fontSize:14, color:"#fff" };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:60, background:"rgba(3,7,16,.8)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Unsold round"
        style={{ background:"#07101e", border:"1px solid #1a2d50", borderRadius:16, padding:"20px 24px", width:"min(620px, 100%)", maxHeight:"92vh", display:"flex", flexDirection:"column", gap:14, color:"#fff" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:20, fontWeight:900, color:"#f0c040" }}>♻ Unsold round</div>
          <button onClick={onClose} aria-label="Close" style={{ background:"transparent", border:"1px solid #1a2d50", color:"#90a4d4", borderRadius:8, padding:"4px 10px", cursor:"pointer", fontWeight:800 }}>✕</button>
        </div>

        {unsold.length === 0 ? (
          <div style={{ color:"#90a4d4", fontSize:15 }}>There are no unsold players right now.</div>
        ) : <>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ fontSize:12, color:"#4a6080", textTransform:"uppercase", letterSpacing:"1px", fontWeight:700 }}>New base price</div>
            {radio("percent", <>Lower by <input type="number" min={5} max={95} step={5} value={pct} style={num}
              onChange={e => { setMode("percent"); setPct(Math.min(95, Math.max(0, parseInt(e.target.value, 10) || 0))); }} /> %</>)}
            {radio("fixed", <>Set all to ₹ <input type="number" min={min} step={rules.bidStep || 1} value={fixed} style={num}
              onChange={e => { setMode("fixed"); setFixed(Math.max(min, parseInt(e.target.value, 10) || min)); }} /></>)}
            {radio("keep", "Keep their base price")}
            <div style={{ fontSize:13, color:"#4a6080" }}>
              Never below the league minimum of {fmt(min)} and never higher than before. Rounded down to the bid step ({fmt(rules.bidStep)}).
              {atMin && <span style={{ color:"#f0a030" }}> Some players stop at the {fmt(min)} minimum.</span>}
            </div>
          </div>

          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontSize:12, color:"#4a6080", textTransform:"uppercase", letterSpacing:"1px", fontWeight:700 }}>Players ({chosen.length} of {unsold.length})</div>
            <button onClick={() => setPicked(allOn ? new Set() : new Set(unsold.map(x => x.idx)))}
              style={{ background:"transparent", border:"none", color:"#90a4d4", fontWeight:700, cursor:"pointer", fontSize:13 }}>{allOn ? "Select none" : "Select all"}</button>
          </div>
          <div style={{ overflowY:"auto", flex:1, minHeight:80, border:"1px solid #111f3a", borderRadius:10 }}>
            {unsold.map(({ p, idx }) => {
              const on = picked.has(idx), nb = newBase(p);
              return (
                <label key={idx} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderBottom:"1px solid #0a1528", cursor:"pointer", opacity: on ? 1 : .45 }}>
                  <input type="checkbox" checked={on} onChange={() => toggle(idx)} style={{ accentColor:"#f0c040" }} />
                  <span style={{ flex:1, minWidth:0, fontSize:14, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    <span style={{ color:"#3d5070", marginRight:5 }}>#{p.serialNo}</span>{p.name} <span style={{ color:"#4a6080", fontWeight:600, fontSize:12 }}>{p.role}</span>
                  </span>
                  <span style={{ fontSize:14, whiteSpace:"nowrap" }}>
                    {nb !== p.basePrice && <span style={{ color:"#4a6080", textDecoration:"line-through", marginRight:6 }}>{fmt(p.basePrice)}</span>}
                    <b style={{ color:"#f0c040" }}>{fmt(nb)}</b>
                  </span>
                </label>
              );
            })}
          </div>

          <button disabled={!chosen.length} onClick={() => onStart(chosen.map(x => ({ idx: x.idx, base: newBase(x.p) })))}
            style={{ padding:"13px 0", borderRadius:10, border:"none", fontSize:16, fontWeight:900, cursor: chosen.length ? "pointer" : "not-allowed", opacity: chosen.length ? 1 : .4, background:"#f0c040", color:"#050a14" }}>
            ♻ Start unsold round with {chosen.length} player{chosen.length === 1 ? "" : "s"}
          </button>
        </>}
      </div>
    </div>
  );
}
