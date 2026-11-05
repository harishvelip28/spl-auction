import { useState, useRef } from "react";
import html2canvas from "html2canvas";
import type { Team, AuctionConfig } from "../types";
import { ROLE_STYLE, UNCERTAIN_BADGE, MANUAL_BADGE } from "../constants";
import { fmt } from "../utils";
import { PhotoAvatar } from "./PhotoAvatar";
import { buildTeamsDoc, buildTeamsPdf, safeFileName } from "../export";

export function TeamRoster({ teams, config, onClose }: { teams: Team[]; config: AuctionConfig; onClose:()=>void }) {
  const [tab, setTab] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);
  const team = teams[tab];
  const { totalPurse, minPlayers } = config.rules;
  const spent = totalPurse - team.purse;

  const makeDoc = (list: Team[], label: string) => {
    const title = `SPL Auction - ${label}`;
    const blob = buildTeamsDoc(title, list, totalPurse);
    const fileName = `SPL_${safeFileName(label)}_${new Date().toISOString().slice(0,10)}.doc`;
    return { title, blob, fileName };
  };
  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  // "Copy" → download the Word document.
  const downloadDoc = (list: Team[], label: string) => {
    const { blob, fileName } = makeDoc(list, label);
    downloadBlob(blob, fileName);
  };
  // "Send" → share a PDF as a file (WhatsApp appears in the share sheet on phones).
  const sendDoc = async (list: Team[], label: string) => {
    const title = `SPL Auction - ${label}`;
    const blob = buildTeamsPdf(title, list, totalPurse);
    const fileName = `SPL_${safeFileName(label)}_${new Date().toISOString().slice(0,10)}.pdf`;
    const file = new File([blob], fileName, { type: "application/pdf" });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title }); return; }
      catch (e) { if ((e as Error).name === "AbortError") return; }
    }
    // Desktop browsers can't attach files to WhatsApp: download it and open WhatsApp to attach manually.
    downloadBlob(blob, fileName);
    alert(`${fileName} downloaded.\n\nWhatsApp will open now — attach the downloaded file in the chat.`);
    window.open("https://web.whatsapp.com/", "_blank", "noopener,noreferrer");
  };
  const downloadImg = async () => {
    if (!tableRef.current) return;
    try {
      const tmp = document.createElement("div");
      tmp.style.cssText = "position:absolute;top:-9999px;left:-9999px;background:#07101e;padding:20px;border-radius:8px;";
      const clone = tableRef.current.cloneNode(true) as HTMLElement;
      clone.style.overflow="visible"; clone.style.maxHeight="none"; clone.style.maxWidth="900px";
      tmp.appendChild(clone); document.body.appendChild(tmp);
      const canvas = await html2canvas(tmp, { backgroundColor:"#07101e", scale:2, useCORS:true, logging:false });
      document.body.removeChild(tmp);
      const a = document.createElement("a"); a.href=canvas.toDataURL("image/png");
      a.download=`${team.name}_players_${Date.now()}.png`; a.click();
    } catch { alert("Failed to download."); }
  };


  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.88)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
      <div style={{ background:"#07101e", border:"1px solid #1a2d50", borderRadius:16, width:"min(98vw,1400px)", maxHeight:"94vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ background:"#0a1528", padding:"16px 22px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid #1a2d50" }}>
          <span style={{ fontSize:20, fontWeight:800, color:"#f0c040", letterSpacing:".5px" }}>Team Rosters</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#4a6080", fontSize:24, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ display:"flex", borderBottom:"1px solid #1a2d50", overflowX:"auto", background:"#06101e" }}>
          {teams.map((t,i) => (
            <button key={t.name} onClick={()=>setTab(i)}
              style={{ padding:"10px 20px", border:"none", cursor:"pointer", fontSize:15, fontWeight:700,
                borderBottom:`3px solid ${tab===i?t.color:"transparent"}`, background:"transparent",
                color: tab===i?t.color:"#4a6080", whiteSpace:"nowrap" }}>
              {t.name}
              <span style={{ marginLeft:6, fontSize:13, background:"#111f3a", color:"#6a80aa", padding:"1px 7px", borderRadius:20 }}>{t.players.length}</span>
            </button>
          ))}
        </div>
        <div style={{ display:"flex", gap:28, padding:"14px 22px", borderBottom:"1px solid #1a2d50", background:"#060e1b", flexWrap:"wrap" }}>
          {[
            { label:"Players",     val:`${team.players.length}/${minPlayers} min`,                      color:team.players.length>=minPlayers?"#30d158":"#f0c040" },
            { label:"Purse spent", val:fmt(spent),                                                      color:"#f0c040" },
            { label:"Purse left",  val:fmt(team.purse),                                                 color:team.purse<1000?"#ff5f57":"#30d158" },
            { label:"Avg bid",     val:team.players.length?fmt(Math.round(spent/team.players.length)):"—", color:"#90a4d4" },
          ].map(s => (
            <div key={s.label} style={{ textAlign:"center", minWidth:90 }}>
              <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.val}</div>
              <div style={{ fontSize:12, color:"#4a6080", textTransform:"uppercase", letterSpacing:".5px", marginTop:2 }}>{s.label}</div>
            </div>
          ))}
          <div style={{ flex:1, minWidth:160, display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ flex:1, height:5, background:"#111f3a", borderRadius:4, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${(team.purse/totalPurse)*100}%`, background:team.purse<1000?"#ff5f57":team.color, borderRadius:4, transition:"width .3s" }} />
            </div>
            <span style={{ fontSize:13, color:"#4a6080", whiteSpace:"nowrap" }}>{Math.round((team.purse/totalPurse)*100)}% left</span>
          </div>
        </div>
        <div style={{ padding:"10px 22px", borderBottom:"1px solid #1a2d50", background:"#07121f", display:"flex", gap:8, flexWrap:"wrap" }}>
          {[
            { label:"Copy Team", onClick:()=>downloadDoc([team], team.name), bg:"#111f3a", color:"#90a4d4" },
            { label:"Send Team", onClick:()=>sendDoc([team], team.name),     bg:"#0d2b0d", color:"#4caf50" },
            { label:"Copy All",  onClick:()=>downloadDoc(teams, "All Teams"), bg:"#0a1830", color:"#90a4d4" },
            { label:"Send All",  onClick:()=>sendDoc(teams, "All Teams"),     bg:"#0d2b0d", color:"#4caf50" },
          ].map(b => (
            <button key={b.label} onClick={b.onClick}
              style={{ padding:"7px 14px", border:"1px solid #1a2d50", borderRadius:7, fontSize:14, cursor:"pointer", fontWeight:700, background:b.bg, color:b.color }}>
              {b.label}
            </button>
          ))}
          {team.players.length >= minPlayers && (
            <button onClick={downloadImg}
              style={{ padding:"7px 14px", border:"1px solid #3a2800", borderRadius:7, fontSize:14, cursor:"pointer", fontWeight:700, background:"#2b1f00", color:"#f0c040" }}>
              📸 Download Image
            </button>
          )}
        </div>
        <div ref={tableRef} style={{ overflowY:"auto", overflowX:"auto", flex:1 }}>
          {team.players.length === 0 ? (
            <div style={{ padding:40, textAlign:"center", color:"#4a6080", fontSize:18 }}>No players bought yet</div>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:16 }}>
              <thead>
                <tr style={{ background:"#0a1528", position:"sticky", top:0 }}>
                  {["#","Photo","Player","Role","City / State","Mobile","Bid"].map(h => (
                    <th key={h} style={{ padding:"10px 16px", textAlign:"center", color:"#4a6080", fontWeight:700, fontSize:13, textTransform:"uppercase", letterSpacing:".5px", borderBottom:"1px solid #1a2d50" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {team.players.map((pl,i) => (
                  <tr key={pl.serialNo} style={{ borderBottom:"1px solid #0a1528", background:i%2===0?"transparent":"#060e1b" }}>
                    <td style={{ padding:"10px 16px", color:"#4a6080", textAlign:"center" }}>{pl.serialNo}</td>
                    <td style={{ padding:"8px 16px", textAlign:"center" }}><div style={{ display:"flex", justifyContent:"center" }}><PhotoAvatar photo={pl.photo} name={pl.name} size={34} /></div></td>
                    <td style={{ padding:"10px 16px", color:"#fff", fontWeight:600, textAlign:"center" }}>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                        {pl.name}
                        {pl.availabilityUncertain && <span style={{ fontSize:12, padding:"1px 7px", borderRadius:20, fontWeight:700, ...UNCERTAIN_BADGE }}>May/May Not</span>}
                        {pl.manuallyAdded && <span style={{ fontSize:12, padding:"1px 7px", borderRadius:20, fontWeight:700, ...MANUAL_BADGE }}>Manual</span>}
                      </div>
                    </td>
                    <td style={{ padding:"10px 16px", textAlign:"center" }}>
                      <span style={{ fontSize:13, padding:"2px 8px", borderRadius:20, fontWeight:600, ...(ROLE_STYLE[pl.role]??{background:"#1a2d50",color:"#90a4d4",border:"1px solid #2a3d6a"}) }}>{pl.role}</span>
                    </td>
                    <td style={{ padding:"10px 16px", color:"#6a80aa", textAlign:"center" }}>{pl.city}{pl.state&&pl.state!=="—"?`, ${pl.state}`:""}</td>
                    <td style={{ padding:"10px 16px", color:"#6a80aa", textAlign:"center" }}>{pl.mobile||"—"}</td>
                    <td style={{ padding:"10px 16px", color:"#f0c040", fontWeight:800, textAlign:"center" }}>{fmt(pl.soldPrice??pl.currentBid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
