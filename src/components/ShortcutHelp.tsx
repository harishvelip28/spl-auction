/* Keyboard shortcut cheat sheet for the operator console (opened with "?" or the ⌨ button). */

const KEYS: [string, string][] = [
  ["1 – 9",            "Bid for that team (number shown on each team button)"],
  ["−  or  Backspace", "Retract the last bid"],
  ["G",                "Going once → going twice → SOLD"],
  ["Esc",              "Cancel the going once / twice call"],
  ["→  /  ←",          "Next / previous player"],
  ["R",                "Draw a random player"],
  ["M",                "Sound on / off"],
  ["?",                "Show or hide this list"],
];

export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  return (
    <div onClick={onClose}
      style={{ position:"fixed", inset:0, zIndex:60, background:"rgba(3,7,16,.75)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Keyboard shortcuts"
        style={{ background:"#07101e", border:"1px solid #1a2d50", borderRadius:16, padding:"22px 26px", width:"min(520px, 100%)", boxShadow:"0 20px 60px rgba(0,0,0,.6)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:20, fontWeight:900, color:"#f0c040" }}>⌨ Keyboard shortcuts</div>
          <button onClick={onClose} aria-label="Close"
            style={{ background:"transparent", border:"1px solid #1a2d50", color:"#90a4d4", borderRadius:8, padding:"4px 10px", cursor:"pointer", fontWeight:800 }}>✕</button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {KEYS.map(([k, what]) => (
            <div key={k} style={{ display:"grid", gridTemplateColumns:"150px 1fr", gap:14, alignItems:"center" }}>
              <kbd style={{ justifySelf:"start", background:"#111f3a", border:"1px solid #2a3d6a", borderBottomWidth:3, borderRadius:7, padding:"4px 10px",
                fontFamily:"inherit", fontSize:14, fontWeight:800, color:"#fff", whiteSpace:"nowrap" }}>{k}</kbd>
              <span style={{ fontSize:15, color:"#90a4d4" }}>{what}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop:18, fontSize:13, color:"#4a6080", lineHeight:1.6 }}>
          Shortcuts work on the auction screen when no text box is selected.<br />
          On the 📺 projector window: <b style={{ color:"#90a4d4" }}>F</b> or double-click toggles fullscreen.
        </div>
      </div>
    </div>
  );
}
