import { DOWNLOADS, downloadUrl, driveDownloadUrl } from "./downloads";

const btn = { display:"inline-block", padding:"9px 16px", fontSize:14, fontWeight:800, borderRadius:8, textDecoration:"none", background:"#f0c040", color:"#050a14", whiteSpace:"nowrap" } as const;

export default function Downloads({ onBack }: { onBack: () => void }) {
  const items = DOWNLOADS.filter(d => d.file || d.drive || d.link);
  return (
    <div style={{ minHeight:"100vh", padding:"40px 16px", background:"radial-gradient(ellipse at top, #0c1a33 0%, #030710 60%)", color:"#fff",
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", boxSizing:"border-box" }}>
      <div style={{ maxWidth:640, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ width:56, height:56, margin:"0 auto 16px", borderRadius:12, background:"#f0c040", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>🏏</div>
          <div style={{ fontSize:24, fontWeight:800, color:"#f0c040" }}>SPL Downloads</div>
          <div style={{ fontSize:14, color:"#6a80aa", marginTop:6 }}>Player registration form, logo and other files</div>
        </div>

        {items.length === 0 && (
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
