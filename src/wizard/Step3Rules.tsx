import type { RulesConfig, AuctionConfig } from "../types";
import { fmt } from "../utils";
import { wizInp, wizLbl } from "./styles";

/* Step 3: Rules */
export function Step3Rules({ cfg, onChange }: { cfg: AuctionConfig; onChange:(c:AuctionConfig)=>void }) {
  const upd = (key: keyof RulesConfig, val: number) => onChange({ ...cfg, rules: { ...cfg.rules, [key]: val } });
  const field = (label: string, key: keyof RulesConfig, min: number, step: number, prefix = "₹") => (
    <div key={key}>
      <label style={wizLbl}>{label}</label>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        {prefix && <span style={{ color:"#f0c040", fontWeight:700, fontSize:18 }}>{prefix}</span>}
        <input type="number" style={{ ...wizInp, width:200 }} min={min} step={step}
          value={cfg.rules[key]} onChange={e=>upd(key, Math.max(min, parseInt(e.target.value,10)||min))} />
      </div>
    </div>
  );
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {field("Total Purse per Team", "totalPurse", 1000, 500)}
      {field("Minimum Players Required", "minPlayers", 1, 1, "")}
      {field("Bid Step", "bidStep", 10, 10)}
      {field("Default Base Price", "defaultBasePrice", 100, 50)}
      <div style={{ background:"#070f1e", border:"1px solid #1a2d50", borderRadius:8, padding:"12px 14px", fontSize:14, color:"#4a6080", lineHeight:1.8 }}>
        Teams start with {fmt(cfg.rules.totalPurse)} · Bids raise in {fmt(cfg.rules.bidStep)} steps ·
        Players start at {fmt(cfg.rules.defaultBasePrice)} minimum · Each team must buy ≥{cfg.rules.minPlayers} players
      </div>
    </div>
  );
}
