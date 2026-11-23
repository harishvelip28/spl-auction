import { useState } from "react";
import { DOWNLOADS, LEAGUE_LOGOS, downloadUrl, driveDownloadUrl } from "./downloads";
import { leagueBrand } from "./storage";

const btn = { display:"inline-block", padding:"9px 16px", fontSize:14, fontWeight:800, borderRadius:8, textDecoration:"none", background:"#f0c040", color:"#050a14", whiteSpace:"nowrap" } as const;

export default function Downloads({ onBack }: { onBack: () => void }) {
  const [brand] = useState(leagueBrand);
  const [logoOk, setLogoOk] = useState(true);
  const [openLeague, setOpenLeague] = useState<string | null>(null);
  const items = DOWNLOADS.filter(d => d.file || d.drive || d.link);
  const packs = LEAGUE_LOGOS.map(l => ({ ...l, logos: l.logos.filter(x => x.file) })).filter(l => l.logos.length);
  return (
    <div style={{ minHeight:"100vh", padding:"40px 16px", background:"radial-gradient(ellipse at top, #0c1a33 0%, #030710 60%)", color:"#fff",
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", boxSizing:"border-box" }}>
      <div style={{ maxWidth:640, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          {brand.logo && logoOk
            ? <img src={brand.logo} alt="" width={72} height={72} onError={() => setLogoOk(false)}
                style={{ display:"block", width:72, height:72, margin:"0 auto 16px", borderRadius:"50%", objectFit:"cover", boxShadow:"0 0 0 3px #f0c040" }} />
            : <div style={{ width:56, height:56, margin:"0 auto 16px", borderRadius:12, background:"#f0c040", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>🏏</div>}
          <div style={{ fontSize:24, fontWeight:800, color:"#f0c040" }}>{brand.name} Downloads</div>
          <div style={{ fontSize:14, color:"#6a80aa", marginTop:6 }}>Player registration form, logos and other files</div>
        </div>

        {packs.length > 0 && (
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#6a80aa", letterSpacing:"1px", textTransform:"uppercase", marginBottom:10 }}>Logos</div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {packs.map(l => {
                const open = openLeague === l.league;
                return (
                  <div key={l.league} style={{ background:"#07101e", border:"1px solid #1a2d50", borderRadius:12, overflow:"hidden" }}>
                    <button onClick={() => setOpenLeague(open ? null : l.league)} aria-expanded={open}
                      style={{ width:"100%", display:"flex", alignItems:"center", gap:14, padding:"16px 18px", background:"none", border:"none", color:"#fff", cursor:"pointer", textAlign:"left" }}>
                      <img src={downloadUrl(l.logos[0].file)} alt="" width={40} height={40} style={{ width:40, height:40, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:16, fontWeight:800 }}>{l.league}</div>
                        <div style={{ fontSize:13, color:"#6a80aa", marginTop:3 }}>League and team logos ({l.logos.length})</div>
                      </div>
                      <span style={{ color:"#f0c040", fontSize:18, transform: open ? "rotate(180deg)" : "none", transition:"transform .15s" }}>▾</span>
                    </button>
                    {open && (
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(140px, 1fr))", gap:12, padding:"0 18px 18px" }}>
                        {l.logos.map(x => {
                          const name = x.file.split("/").pop()!;
                          return (
                            <div key={x.file} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, padding:12, background:"#0a1528", border:"1px solid #1a2d50", borderRadius:10 }}>
                              <img src={downloadUrl(x.file)} alt={x.title} loading="lazy"
                                style={{ width:"100%", aspectRatio:"1", objectFit:"contain", borderRadius:8, background:"#000" }} />
                              <div style={{ fontSize:13, fontWeight:700, textAlign:"center" }}>{x.title}</div>
                              <a href={downloadUrl(x.file)} download={name} style={{ ...btn, padding:"7px 12px", fontSize:13 }}>⬇ Download</a>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {items.length === 0 && packs.length === 0 && (
          <div style={{ textAlign:"center", padding:24, color:"#6a80aa", background:"#07101e", border:"1px solid #1a2d50", borderRadius:12 }}>
            Nothing to download yet. Check back soon.
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {items.map(d => (
            <div key={d.title} style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", padding:"16px 18px", background:"#07101e", border:"1px solid #1a2d50", borderRadius:12 }}>
              <div style={{ fontSize:28, flexShrink:0 }}>{d.icon}</div>
              <div style={{ flex:"1 1 200px", minWidth:0 }}>
                <div style={{ fontSize:16, fontWeight:800 }}>{d.title}</div>
                <div style={{ fontSize:13, color:"#6a80aa", marginTop:3 }}>{d.description}</div>
              </div>
              {d.disabled ? <span aria-disabled="true" style={{ ...btn, background:"#1a2d50", color:"#6a80aa", cursor:"not-allowed" }}>Not available yet</span>
                : d.file ? <a href={downloadUrl(d.file)} download={d.file} style={btn}>⬇ Download</a>
                : d.drive ? <a href={driveDownloadUrl(d.drive)} rel="noopener noreferrer" style={btn}>⬇ Download</a>
                : <a href={d.link} target="_blank" rel="noopener noreferrer" style={btn}>↗ Open</a>}
            </div>
          ))}
        </div>

        <div style={{ textAlign:"center", marginTop:28 }}>
          <button onClick={onBack} style={{ background:"none", border:"none", color:"#6a80aa", fontSize:14, cursor:"pointer", textDecoration:"underline" }}>
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}
