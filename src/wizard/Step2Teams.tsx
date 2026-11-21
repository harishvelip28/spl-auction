import { useState } from "react";
import type { TeamDef, AuctionConfig } from "../types";
import { PRESET_COLORS } from "../constants";
import { wizInp, wizLbl } from "./styles";
import { TeamAvatar } from "../components/TeamAvatar";
import { shrinkLogo } from "../logo";

const splitNames = (txt: string) => {
  const seen = new Set<string>();
  return txt.split(/[\n,]/).map(n => n.trim()).filter(n => {
    const k = n.toLowerCase();
    if (!n || seen.has(k)) return false;
    seen.add(k); return true;
  });
};

/* Step 2: Teams */
export function Step2Teams({ cfg, onChange }: { cfg: AuctionConfig; onChange:(c:AuctionConfig)=>void }) {
  const [editIdx, setEditIdx] = useState<number|null>(null);
  const [showPicker, setShowPicker] = useState<number|null>(null);
  // Icon players: names pasted here, then each team picks its one from the list.
  const [iconTxt, setIconTxt] = useState(() => cfg.teams.map(t => t.icon?.trim()).filter(Boolean).join("\n"));
  const iconNames = splitNames(iconTxt);
  const holder = (name: string) => cfg.teams.findIndex(t => t.icon?.trim().toLowerCase() === name.toLowerCase());
  const setIcon = (i: number, name: string) => {
    const t = [...cfg.teams]; t[i] = { ...t[i], icon: name || undefined };
    onChange({ ...cfg, teams: t });
  };
  // Pasting changes the list: drop assignments whose name is no longer in it.
  const changeIconTxt = (txt: string) => {
    setIconTxt(txt);
    const keep = new Set(splitNames(txt).map(n => n.toLowerCase()));
    if (cfg.teams.some(t => t.icon && !keep.has(t.icon.trim().toLowerCase())))
      onChange({ ...cfg, teams: cfg.teams.map(t => t.icon && !keep.has(t.icon.trim().toLowerCase()) ? { ...t, icon: undefined } : t) });
  };
  const fillInOrder = () => onChange({ ...cfg, teams: cfg.teams.map((t, i) => ({ ...t, icon: iconNames[i] })) });

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
    // Optional fields are dropped when cleared rather than saved as "".
    const optional = key === "owner" || key === "logo";
    const t = [...cfg.teams]; t[i] = { ...t[i], [key]: optional && !val ? undefined : val };
    onChange({ ...cfg, teams: t });
  };
  const pickLogo = async (i: number, f: File | undefined) => {
    if (!f) return;
    try { updTeam(i, "logo", await shrinkLogo(f)); }
    catch { alert("Could not read that image. Try a PNG or JPG file."); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ background:"#07101e", border:"1px solid #1a2d50", borderRadius:9, padding:"12px 14px", marginBottom:6 }}>
        <label style={wizLbl}>⭐ Icon players <span style={{ textTransform:"none", letterSpacing:0, fontWeight:400, color:"#4a6080" }}>— one per team, in the squad before bidding starts</span></label>
        <textarea value={iconTxt} onChange={e=>changeIconTxt(e.target.value)} rows={3}
          placeholder={"Paste icon player names, one per line\n(then pick each team's icon below)"}
          style={{ ...wizInp, fontSize:14, padding:"8px 12px", resize:"vertical", fontFamily:"inherit" }} />
        {iconNames.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginTop:8, flexWrap:"wrap" }}>
            <span style={{ fontSize:13, color:"#6a80aa" }}>
              {iconNames.length} name{iconNames.length === 1 ? "" : "s"} · {cfg.teams.filter(t => t.icon).length}/{cfg.teams.length} teams assigned
            </span>
            <button onClick={fillInOrder} title="First name → first team, second → second team, …"
              style={{ padding:"5px 12px", border:"1px solid #1a2d50", borderRadius:7, background:"#0c1830", color:"#90a4d4", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              Assign in list order
            </button>
          </div>
        )}
      </div>
      <div style={{ fontSize:13, color:"#4a6080", marginBottom:4, textTransform:"uppercase", letterSpacing:".5px", fontWeight:600 }}>
        {cfg.teams.length} Teams — click a name to rename it, the circle to add a logo
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
          {/* Logo */}
          <div style={{ position:"relative", flexShrink:0 }}>
            <label title={team.logo ? "Change logo" : "Add logo"} style={{ display:"block", cursor:"pointer" }}>
              {team.logo
                ? <TeamAvatar team={team} size={40} />
                : <div style={{ width:40, height:40, borderRadius:"50%", border:"2px dashed #2a3d60", display:"flex", alignItems:"center", justifyContent:"center",
                    color:"#4a6080", fontSize:10, fontWeight:700, lineHeight:1.1, textAlign:"center" }}>+<br/>logo</div>}
              <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ const f = e.target.files?.[0]; e.target.value = ""; void pickLogo(i, f); }} />
            </label>
            {team.logo && (
              <button onClick={()=>updTeam(i,"logo","")} title="Remove logo"
                style={{ position:"absolute", top:-5, right:-6, width:17, height:17, borderRadius:"50%", border:"1px solid #2a3d60", background:"#0c1830",
                  color:"#90a4d4", fontSize:10, lineHeight:1, padding:0, cursor:"pointer" }}>✕</button>
            )}
          </div>
          {/* Name + owner */}
          <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:4, textAlign:"left" }}>
            {editIdx===i ? (
              <input autoFocus style={{ ...wizInp, padding:"6px 10px", fontSize:15 }} value={team.name}
                onChange={e=>updTeam(i,"name",e.target.value)} onBlur={()=>setEditIdx(null)}
                onKeyDown={e=>{ if(e.key==="Enter") setEditIdx(null); }} />
            ) : (
              <span onClick={()=>setEditIdx(i)} style={{ fontSize:16, color:"#fff", fontWeight:600, cursor:"text" }}>{team.name}</span>
            )}
            <input value={team.owner ?? ""} onChange={e=>updTeam(i,"owner",e.target.value)} placeholder="Owner name (optional)"
              style={{ ...wizInp, padding:"4px 10px", fontSize:13 }} />
          </div>
          {iconNames.length > 0 && (
            <select value={iconNames.find(n => n.toLowerCase() === team.icon?.trim().toLowerCase()) ?? ""} onChange={e=>setIcon(i, e.target.value)}
              title="Icon player" style={{ ...wizInp, width:170, flexShrink:0, padding:"6px 8px", fontSize:14, cursor:"pointer", color: team.icon ? "#f0c040" : "#6a80aa" }}>
              <option value="">⭐ No icon</option>
              {iconNames.map(n => {
                const h = holder(n);
                return <option key={n} value={n} disabled={h >= 0 && h !== i}>⭐ {n}{h >= 0 && h !== i ? ` (${cfg.teams[h].name})` : ""}</option>;
              })}
            </select>
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
