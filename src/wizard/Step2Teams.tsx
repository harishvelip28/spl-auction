import { useState } from "react";
import type { TeamDef, AuctionConfig } from "../types";
import { PRESET_COLORS } from "../constants";
import { wizInp } from "./styles";

/* Step 2: Teams */
export function Step2Teams({ cfg, onChange }: { cfg: AuctionConfig; onChange:(c:AuctionConfig)=>void }) {
  const [editIdx, setEditIdx] = useState<number|null>(null);
  const [showPicker, setShowPicker] = useState<number|null>(null);

  const addTeam = () => {
    const next = [...cfg.teams, { name: "New Team", color: PRESET_COLORS[cfg.teams.length % PRESET_COLORS.length] }];
    onChange({ ...cfg, teams: next });
    setEditIdx(next.length - 1);
  };
  const delTeam = (i: number) => {
    if (cfg.teams.length <= 2) { alert("Need at least 2 teams."); return; }
    const t = [...cfg.teams]; t.splice(i,1);
    onChange({ ...cfg, teams: t });
  };
  const updTeam = (i: number, key: keyof TeamDef, val: string) => {
    const t = [...cfg.teams]; t[i] = { ...t[i], [key]: val };
    onChange({ ...cfg, teams: t });
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ fontSize:13, color:"#4a6080", marginBottom:4, textTransform:"uppercase", letterSpacing:".5px", fontWeight:600 }}>
        {cfg.teams.length} Teams — click a team to rename it
      </div>
      {cfg.teams.map((team, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:10, background:"#07101e", border:"1px solid #1a2d50", borderRadius:9, padding:"10px 14px" }}>
          {/* Color picker */}
          <div style={{ position:"relative" }}>
            <div onClick={()=>setShowPicker(showPicker===i?null:i)}
              style={{ width:28, height:28, borderRadius:"50%", background:team.color, cursor:"pointer", border:"2px solid #2a3d60", flexShrink:0 }} />
            {showPicker===i && (
              <div style={{ position:"absolute", top:36, left:0, zIndex:100, background:"#0c1830", border:"1px solid #1a2d50", borderRadius:10, padding:10, display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
                {PRESET_COLORS.map(c => (
                  <div key={c} onClick={()=>{ updTeam(i,"color",c); setShowPicker(null); }}
                    style={{ width:24, height:24, borderRadius:"50%", background:c, cursor:"pointer", border:`2px solid ${team.color===c?"#fff":"transparent"}` }} />
                ))}
                <div style={{ gridColumn:"1/-1", marginTop:4 }}>
                  <input type="color" value={team.color} onChange={e=>updTeam(i,"color",e.target.value)}
                    style={{ width:"100%", height:28, border:"none", borderRadius:4, cursor:"pointer", background:"none" }} />
                </div>
              </div>
            )}
          </div>
          {/* Name */}
          {editIdx===i ? (
            <input autoFocus style={{ ...wizInp, flex:1, padding:"6px 10px", fontSize:15 }} value={team.name}
              onChange={e=>updTeam(i,"name",e.target.value)} onBlur={()=>setEditIdx(null)}
              onKeyDown={e=>{ if(e.key==="Enter") setEditIdx(null); }} />
          ) : (
            <span onClick={()=>setEditIdx(i)} style={{ flex:1, fontSize:16, color:"#fff", fontWeight:600, cursor:"text" }}>{team.name}</span>
          )}
          <button onClick={()=>delTeam(i)} style={{ background:"none", border:"none", color:"#4a6080", fontSize:18, cursor:"pointer", padding:"0 4px", lineHeight:1 }}>✕</button>
        </div>
      ))}
      <button onClick={addTeam}
        style={{ padding:"10px 0", border:"1px dashed #1a2d50", borderRadius:9, background:"transparent", color:"#4a80c4", fontSize:15, fontWeight:700, cursor:"pointer", marginTop:4 }}>
        + Add Team
      </button>
    </div>
  );
}
