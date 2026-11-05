import React, { useState } from "react";
import type { Player, AuctionConfig } from "../types";
import { fmt, normPlayer } from "../utils";

export function AddPlayerModal({ nextSerial, config, onAdd, onClose }: {
  nextSerial: number; config: AuctionConfig; onAdd:(p:Player)=>void; onClose:()=>void;
}) {
  const [form, setForm] = useState({ name:"", mobile:"", role:"Batsman", batting:"Right Hand", bowling:"N/A", city:"", state:"", basePrice:String(config.rules.defaultBasePrice), photo:"", availabilityUncertain:false });
  const [photoTab, setPhotoTab] = useState<"upload"|"url">("upload");
  const [preview, setPreview] = useState("");
  const set = <K extends keyof typeof form>(k:K, v:(typeof form)[K]) => setForm(f=>({...f,[k]:v}));

  const submit = () => {
    if (!form.name.trim()) { alert("Player name is required."); return; }
    const bp = Math.max(config.rules.defaultBasePrice, parseInt(form.basePrice,10)||config.rules.defaultBasePrice);
    onAdd(normPlayer({ serialNo:nextSerial, name:form.name.trim(), mobile:form.mobile.trim(), role:form.role, batting:form.batting, bowling:form.bowling, city:form.city.trim()||"—", state:form.state.trim()||"—", photo:form.photo.trim(), basePrice:bp, currentBid:bp, availabilityUncertain:form.availabilityUncertain, manuallyAdded:true, status:"available" }, nextSerial, config.rules.defaultBasePrice));
    onClose();
  };
  const inp: React.CSSProperties = { width:"100%", background:"#0a1428", border:"1px solid #1a2d50", borderRadius:7, padding:"9px 12px", fontSize:16, color:"#fff", outline:"none" };
  const lbl: React.CSSProperties = { fontSize:13, color:"#6a80aa", marginBottom:5, display:"block", textTransform:"uppercase", letterSpacing:".5px", fontWeight:600 };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.88)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1100 }}>
      <div style={{ background:"#07101e", border:"1px solid #1a2d50", borderRadius:16, width:"min(95vw,520px)", maxHeight:"92vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ background:"#0a1528", padding:"16px 22px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid #1a2d50" }}>
          <span style={{ fontSize:20, fontWeight:800, color:"#f0c040" }}>Add Player</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#4a6080", fontSize:24, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ overflowY:"auto", padding:22, display:"flex", flexDirection:"column", gap:16 }}>
          <div><label style={lbl}>Name *</label><input style={inp} value={form.name} placeholder="Full name" onChange={e=>set("name",e.target.value)} /></div>
          <div><label style={lbl}>Phone Number</label><input style={inp} value={form.mobile} placeholder="Mobile number" onChange={e=>set("mobile",e.target.value)} /></div>
          <label style={{ display:"flex", alignItems:"flex-start", gap:10, background:"#060e1b", border:"1px solid #1a2d50", borderRadius:8, padding:"12px 14px", cursor:"pointer" }}>
            <input type="checkbox" checked={form.availabilityUncertain} onChange={e=>set("availabilityUncertain",e.target.checked)} style={{ marginTop:3 }} />
            <span>
              <span style={{ display:"block", fontSize:16, color:"#fff", fontWeight:600 }}>May or may not be playing</span>
              <span style={{ display:"block", fontSize:14, color:"#4a6080", marginTop:3 }}>Adds a marker throughout the auction and roster views.</span>
            </span>
          </label>
          <div style={{ display:"flex", gap:12 }}>
            <div style={{ flex:1 }}><label style={lbl}>Role</label><select style={{ ...inp, cursor:"pointer" }} value={form.role} onChange={e=>set("role",e.target.value)}><option>Batsman</option><option>Bowler</option><option>All-Rounder</option><option>Wicket Keeper</option></select></div>
            <div style={{ flex:1 }}><label style={lbl}>Batting</label><select style={{ ...inp, cursor:"pointer" }} value={form.batting} onChange={e=>set("batting",e.target.value)}><option>Right Hand</option><option>Left Hand</option></select></div>
          </div>
          <div><label style={lbl}>Bowling</label><select style={{ ...inp, cursor:"pointer" }} value={form.bowling} onChange={e=>set("bowling",e.target.value)}><option>N/A</option><option>Right Arm Fast</option><option>Left Arm Fast</option><option>Right Arm Spin</option><option>Left Arm Spin</option></select></div>
          <div style={{ display:"flex", gap:12 }}>
            <div style={{ flex:1 }}><label style={lbl}>City</label><input style={inp} value={form.city} placeholder="City" onChange={e=>set("city",e.target.value)} /></div>
            <div style={{ flex:1 }}><label style={lbl}>State</label><input style={inp} value={form.state} placeholder="State" onChange={e=>set("state",e.target.value)} /></div>
          </div>
          <div><label style={lbl}>Base Price (₹) — min {fmt(config.rules.defaultBasePrice)}</label><input type="number" style={inp} value={form.basePrice} min={config.rules.defaultBasePrice} step={config.rules.bidStep} onChange={e=>set("basePrice",e.target.value)} /></div>
          <div>
            <label style={lbl}>Photo (optional)</label>
            <div style={{ display:"flex", marginBottom:10, border:"1px solid #1a2d50", borderRadius:8, overflow:"hidden" }}>
              {(["upload","url"] as const).map(t => (
                <button key={t} onClick={()=>{ setPhotoTab(t); set("photo",""); setPreview(""); }}
                  style={{ flex:1, padding:"7px 0", border:"none", cursor:"pointer", fontSize:14, fontWeight:700, background:photoTab===t?"#1a2d50":"transparent", color:photoTab===t?"#90a4d4":"#4a6080" }}>
                  {t==="upload"?"📁 Upload":"🔗 URL"}
                </button>
              ))}
            </div>
            {photoTab==="upload" ? (
              <label style={{ display:"block", cursor:"pointer" }}
                onDragOver={e=>e.preventDefault()}
                onDrop={e=>{ e.preventDefault(); const f=e.dataTransfer.files?.[0]; if(f&&f.type.startsWith("image/")){ const rd=new FileReader(); rd.onload=ev=>{ const d=ev.target?.result as string; setPreview(d); set("photo",d); }; rd.readAsDataURL(f); } }}>
                <div style={{ border:"2px dashed #1a2d50", borderRadius:8, padding:"20px 12px", textAlign:"center", color:"#4a6080", fontSize:15, background:"#060e1b" }}>
                  {preview && photoTab==="upload" ? <img src={preview} alt="preview" style={{ maxHeight:100, maxWidth:"100%", borderRadius:6, objectFit:"contain" }} /> : "Click or drag & drop an image"}
                </div>
                <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; const rd=new FileReader(); rd.onload=ev=>{ const d=ev.target?.result as string; setPreview(d); set("photo",d); }; rd.readAsDataURL(f); }} />
              </label>
            ) : (
              <div>
                <input style={inp} value={form.photo} placeholder="Paste Google Drive or image URL" onChange={e=>{ set("photo",e.target.value); setPreview(e.target.value); }} />
                {preview && <img src={preview} alt="preview" style={{ marginTop:8, maxHeight:90, maxWidth:"100%", borderRadius:6, objectFit:"contain", display:"block" }} onError={e=>(e.currentTarget.style.display="none")} />}
              </div>
            )}
          </div>
        </div>
        <div style={{ padding:"14px 22px", borderTop:"1px solid #1a2d50", background:"#0a1528", display:"flex", justifyContent:"flex-end", gap:10 }}>
          <button onClick={onClose} style={{ padding:"9px 18px", border:"1px solid #1a2d50", borderRadius:8, fontSize:16, cursor:"pointer", fontWeight:700, background:"transparent", color:"#6a80aa" }}>Cancel</button>
          <button onClick={submit} style={{ padding:"9px 22px", border:"none", borderRadius:8, fontSize:16, cursor:"pointer", fontWeight:800, background:"#f0c040", color:"#050a14" }}>Add to Auction</button>
        </div>
      </div>
    </div>
  );
}
