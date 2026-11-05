import { useState } from "react";
import type { LeagueConfig, AuctionConfig } from "../types";
import { wizInp, wizLbl } from "./styles";

/* Step 1: League */
export function Step1League({ cfg, onChange }: { cfg: AuctionConfig; onChange:(c:AuctionConfig)=>void }) {
  const [tab, setTab] = useState<"upload"|"url">(cfg.league.logo?"url":"upload");
  const upd = (key: keyof LeagueConfig, val: string) => onChange({ ...cfg, league: { ...cfg.league, [key]: val } });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div>
        <label style={wizLbl}>League Name</label>
        <input style={wizInp} value={cfg.league.name} placeholder="e.g. Shigao Premier League" onChange={e=>upd("name",e.target.value)} />
      </div>
      <div>
        <label style={wizLbl}>Year</label>
        <input style={{ ...wizInp, width:160 }} value={cfg.league.year} placeholder="2026" onChange={e=>upd("year",e.target.value)} />
      </div>
      <div>
        <label style={wizLbl}>Logo (optional)</label>
        <div style={{ display:"flex", marginBottom:10, border:"1px solid #1a2d50", borderRadius:8, overflow:"hidden" }}>
          {(["upload","url"] as const).map(t => (
            <button key={t} onClick={()=>{ setTab(t); upd("logo",""); }}
              style={{ flex:1, padding:"8px 0", border:"none", cursor:"pointer", fontSize:14, fontWeight:700,
                background: tab===t?"#1a2d50":"transparent", color: tab===t?"#90a4d4":"#4a6080" }}>
              {t==="upload" ? "📁 Upload" : "🔗 URL"}
            </button>
          ))}
        </div>
        {tab==="upload" ? (
          <label style={{ display:"block", cursor:"pointer" }}>
            <div style={{ border:"2px dashed #1a2d50", borderRadius:8, padding:"20px 14px", textAlign:"center", color:"#4a6080", fontSize:15, background:"#07101e" }}>
              {cfg.league.logo
                ? <img src={cfg.league.logo} alt="logo" style={{ maxHeight:80, maxWidth:"100%", objectFit:"contain", borderRadius:6 }} />
                : "Click to choose or drag & drop an image"}
            </div>
            <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{
              const f = e.target.files?.[0]; if(!f) return;
              const rd = new FileReader(); rd.onload=ev=>upd("logo",ev.target?.result as string); rd.readAsDataURL(f);
            }} />
          </label>
        ) : (
          <input style={wizInp} value={cfg.league.logo} placeholder="https://..." onChange={e=>upd("logo",e.target.value)} />
        )}
      </div>
    </div>
  );
}
