import type { RulesConfig, AuctionConfig, BidTier } from "../types";
import { fmt, callSecs } from "../utils";
import { wizInp, wizLbl } from "./styles";

type NumKey = "totalPurse" | "minPlayers" | "bidStep" | "defaultBasePrice" | "maxPlayers" | "callSeconds";

/* Step 3: Rules */
export function Step3Rules({ cfg, onChange }: { cfg: AuctionConfig; onChange:(c:AuctionConfig)=>void }) {
  const r = cfg.rules;
  const set = (rules: Partial<RulesConfig>) => onChange({ ...cfg, rules: { ...r, ...rules } });
  const field = (label: string, key: NumKey, min: number, step: number, prefix = "₹", hint?: string, fallback = min) => (
    <div key={key}>
      <label style={wizLbl}>{label}</label>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        {prefix && <span style={{ color:"#f0c040", fontWeight:700, fontSize:18 }}>{prefix}</span>}
        <input type="number" style={{ ...wizInp, width:200 }} min={min} step={step}
          value={r[key] ?? fallback} onChange={e=>set({ [key]: Math.max(min, parseInt(e.target.value,10)||min) })} />
        {hint && <span style={{ fontSize:13, color:"#4a6080" }}>{hint}</span>}
      </div>
    </div>
  );

  const tiers = r.bidTiers ?? [];
  const setTiers = (t: BidTier[]) => set({ bidTiers: t });
  const updTier = (i: number, k: keyof BidTier, v: string) =>
    setTiers(tiers.map((t, j) => j === i ? { ...t, [k]: Math.max(0, parseInt(v, 10) || 0) } : t));
  const addTier = () => {
    const last = tiers[tiers.length - 1];
    setTiers([...tiers, last ? { from: last.from * 3, step: last.step * 2 } : { from: r.bidStep * 10, step: r.bidStep * 2 }]);
  };
  const sorted = [...tiers].filter(t => t.step > 0).sort((a, b) => a.from - b.from);
  const maxBelowMin = !!r.maxPlayers && r.maxPlayers < r.minPlayers;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {field("Total Purse per Team", "totalPurse", 1000, 500)}
      {field("Minimum Players Required", "minPlayers", 1, 1, "")}
      {field("Maximum Squad Size", "maxPlayers", 0, 1, "", "0 = no limit", 0)}
      {maxBelowMin && <div style={{ color:"#ff9800", fontSize:14, marginTop:-12 }}>⚠ Maximum is below the minimum — teams could never complete their squad.</div>}
      {field("Default Base Price", "defaultBasePrice", 100, 50)}
      {field("Bid Step", "bidStep", 10, 10, "₹", "raise size from the base price")}

      <div>
        <label style={wizLbl}>Bigger steps at higher prices</label>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {tiers.map((t, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", fontSize:15, color:"#90a4d4" }}>
              From bid <span style={{ color:"#f0c040", fontWeight:700 }}>₹</span>
              <input type="number" min={0} step={100} value={t.from} onChange={e=>updTier(i, "from", e.target.value)} style={{ ...wizInp, width:130 }} />
              raise by <span style={{ color:"#f0c040", fontWeight:700 }}>₹</span>
              <input type="number" min={10} step={10} value={t.step} onChange={e=>updTier(i, "step", e.target.value)} style={{ ...wizInp, width:110 }} />
              <button onClick={()=>setTiers(tiers.filter((_, j) => j !== i))} title="Remove"
                style={{ background:"transparent", border:"1px solid #3a1010", color:"#ff5f57", borderRadius:8, padding:"8px 12px", cursor:"pointer", fontWeight:700 }}>✕</button>
            </div>
          ))}
          <button onClick={addTier}
            style={{ alignSelf:"flex-start", background:"#0c1830", border:"1px solid #1a2d50", color:"#90a4d4", borderRadius:8, padding:"8px 14px", cursor:"pointer", fontWeight:700, fontSize:14 }}>
            + Add price level
          </button>
        </div>
      </div>

      {field("Going once / twice — seconds each", "callSeconds", 0, 1, "", "then auto-SOLD · 0 = manual (press G for each stage)", 5)}

      <div style={{ background:"#070f1e", border:"1px solid #1a2d50", borderRadius:8, padding:"12px 14px", fontSize:14, color:"#4a6080", lineHeight:1.8 }}>
        Teams start with {fmt(r.totalPurse)} · Players start at {fmt(r.defaultBasePrice)} minimum ·
        Each team must buy ≥{r.minPlayers} players{r.maxPlayers ? ` and at most ${r.maxPlayers}` : ""}<br />
        Bids raise by {fmt(r.bidStep)}
        {sorted.map(t => <span key={`${t.from}-${t.step}`}>, then {fmt(t.step)} from {fmt(t.from)}</span>)}
        {" "}· Going once / twice: {callSecs(r) ? `${callSecs(r)}s each, then auto-SOLD` : "manual"}
      </div>
    </div>
  );
}
