import { logout } from "../auth";
import { activeLeague, setActiveLeague } from "../leagues";

export function UserBadge({ user }: { user: string|null }) {
  if (!user) return null;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      {activeLeague() && (
        <button className="cbtn" onClick={() => { setActiveLeague(null); location.reload(); }} title={`${activeLeague()!.name} — switch to another league`}
          style={{ padding:"8px 14px", border:"1px solid #1a2d50", borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:700, background:"#0a1528", color:"#f0c040", whiteSpace:"nowrap" }}>
          ⇄ Switch league
        </button>
      )}
      <span style={{ fontSize:13, color:"#6a80aa", whiteSpace:"nowrap" }}>👤 {user}</span>
      <button className="cbtn" onClick={() => { logout(); location.reload(); }} title="Logout"
        style={{ padding:"8px 14px", border:"1px solid #1a2d50", borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:700, background:"#0a1528", color:"#6a80aa" }}>
        Logout
      </button>
    </div>
  );
}
