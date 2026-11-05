import React, { useState } from "react";

/* Guidance for building the player registration Google Form.
   Question titles match autoMap() keywords so columns map automatically. */
const FORM_FIELDS: { title: string; type: string; required: boolean; answers: string; note?: string }[] = [
  { title: "Player Name",   type: "Short answer",         required: true,  answers: "e.g. Rohit Sharma" },
  { title: "Mobile Number", type: "Short answer",         required: true,  answers: "e.g. 9876543210", note: "Turn on Response validation → Number." },
  { title: "Player Photo",  type: "File upload",          required: false, answers: "1 image, max 10 MB", note: "Clear face photo. See the photo tip below." },
  { title: "Skills",        type: "Checkboxes",           required: true,  answers: "Batsman · Bowler · All-Rounder · Wicket Keeper · Right Hand Bat · Left Hand Bat · Right Arm Fast · Right Arm Spin · Left Arm Fast · Left Arm Spin", note: "Players tick their role, batting hand and bowling style." },
  { title: "City, State",   type: "Short answer",         required: false, answers: "e.g. Pune, Maharashtra", note: "Ask for a comma between city and state." },
  { title: "Availability",  type: "Multiple choice",      required: false, answers: "Will play · May or may not play", note: "\"May or may not play\" shows the May/May Not badge." },
];

export function GoogleFormGuide({ defaultOpen }: { defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const cell: React.CSSProperties = { padding:"8px 10px", borderBottom:"1px solid #111f3a", verticalAlign:"top", fontSize:13, color:"#8899bb", lineHeight:1.5 };
  const h: React.CSSProperties = { ...cell, color:"#4a6080", fontWeight:700, fontSize:11, textTransform:"uppercase", letterSpacing:".5px", textAlign:"left", background:"#0a1528" };
  const stepNum: React.CSSProperties = { flexShrink:0, width:22, height:22, borderRadius:"50%", background:"#1a2d50", color:"#f0c040", fontSize:12, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" };
  return (
    <div style={{ border:"1px solid #1a2d50", borderRadius:10, background:"#07101e", overflow:"hidden" }}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", border:"none", background:"transparent", cursor:"pointer", color:"#90a4d4", fontSize:15, fontWeight:700, textAlign:"left" }}>
        <span>📝 How to set up your Google Form</span>
        <span style={{ color:"#4a6080", fontSize:13 }}>{open ? "Hide ▲" : "Show ▼"}</span>
      </button>
      {open && (
        <div style={{ padding:"0 16px 16px", display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ fontSize:13, color:"#6a80aa", lineHeight:1.6 }}>
            Create a registration form with these questions. Use the <b style={{ color:"#f0c040" }}>exact titles</b> shown so the columns are matched automatically below.
          </div>

          <div style={{ overflowX:"auto", border:"1px solid #111f3a", borderRadius:8 }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:620 }}>
              <thead>
                <tr><th style={h}>Question title</th><th style={h}>Type</th><th style={h}>Answers / example</th><th style={h}>Notes</th></tr>
              </thead>
              <tbody>
                {FORM_FIELDS.map(f => (
                  <tr key={f.title}>
                    <td style={{ ...cell, color:"#fff", fontWeight:700, whiteSpace:"nowrap" }}>
                      {f.title}{f.required && <span style={{ color:"#f0c040" }}> *</span>}
                    </td>
                    <td style={{ ...cell, whiteSpace:"nowrap" }}>{f.type}</td>
                    <td style={cell}>{f.answers}</td>
                    <td style={cell}>{f.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize:12, color:"#4a6080", marginTop:-8 }}>
            <span style={{ color:"#f0c040" }}>*</span> mark as Required in the form. <b style={{ color:"#6a80aa" }}>Base Price</b> isn't a form question — if some players need a higher base, add a "Base Price" column in the response Sheet yourself; everyone else gets the default from Step 3.
          </div>

          <div>
            <div style={{ fontSize:12, color:"#4a6080", fontWeight:700, textTransform:"uppercase", letterSpacing:".5px", marginBottom:10 }}>Then connect it</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[
                <>In the form, open <b style={{ color:"#90a4d4" }}>Responses → Link to Sheets</b> to create a response spreadsheet.</>,
                <>In that Sheet: <b style={{ color:"#90a4d4" }}>File → Share → Publish to web</b>, pick the <b style={{ color:"#90a4d4" }}>Form Responses 1</b> tab and <b style={{ color:"#90a4d4" }}>Comma-separated values (.csv)</b>, then <b style={{ color:"#90a4d4" }}>Publish</b>.</>,
                <>Copy the link, paste it below and press <b style={{ color:"#90a4d4" }}>Detect</b>. New registrations appear automatically.</>,
              ].map((s, i) => (
                <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", fontSize:13, color:"#8899bb", lineHeight:1.6 }}>
                  <span style={stepNum}>{i + 1}</span><span>{s}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize:13, color:"#c9a24a", background:"#1a1400", border:"1px solid #3a2e00", borderRadius:8, padding:"10px 12px", lineHeight:1.6 }}>
            📷 <b>Photo tip:</b> uploaded photos go into a Drive folder that's private by default, so they won't show in the auction. In Google Drive, find the form's upload folder → <b>Share</b> → General access: <b>Anyone with the link → Viewer</b>. Note that File upload questions require players to sign in to Google.
          </div>
        </div>
      )}
    </div>
  );
}
