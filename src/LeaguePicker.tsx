import { LEAGUES, setActiveLeague } from "./leagues";
import { UserBadge } from "./components/UserBadge";

/* Shown after login: one button per league. Each league's setup and auction are saved separately. */
export default function LeaguePicker({ user }: { user: string }) {
  const pick = (id: string) => { setActiveLeague(id); location.reload(); };
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:16,
      background:"radial-gradient(ellipse at top, #0c1a33 0%, #030710 60%)", color:"#fff",
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", boxSizing:"border-box" }}>
      <div style={{ width:"100%", maxWidth:460 }}>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:20 }}><UserBadge user={user} /></div>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div aria-hidden="true" style={{ width:64, height:64, margin:"0 auto 16px", borderRadius:14, background:"#f0c040", display:"flex", alignItems:"center", justifyContent:"center", fontSize:34 }}>🏏</div>
          <div style={{ fontSize:22, fontWeight:800, color:"#f0c040" }}>Choose a league</div>
          <div style={{ fontSize:14, color:"#6a80aa", marginTop:6 }}>Each league's setup and auction are saved separately</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {LEAGUES.map(l => (
            <button key={l.id} className="cbtn" onClick={() => pick(l.id)}
              style={{ width:"100%", padding:"18px 20px", fontSize:17, fontWeight:800, cursor:"pointer", textAlign:"left",
                background:"#07101e", color:"#fff", border:"1px solid #1a2d50", borderRadius:12, display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ flex:1 }}>{l.name}</span>
              <span style={{ color:"#f0c040" }}>→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
