import { useEffect, useState } from "react";
import type React from "react";
import QRCode from "qrcode";
import { liveConfigured, liveUrl, newLiveId, unpublish, FIREBASE_RULES, type ShareState } from "../live";
import { timeAgo } from "../utils";

/* Console panel for the owners' phone link: start/stop sharing, copy the link, show a QR code. */

export type LiveStatus = { ok: boolean; at?: number; msg?: string };

export function LiveShare({ share, onShare, status, onClose }: {
  share: ShareState | null;
  onShare: (s: ShareState) => void;
  status: LiveStatus;
  onClose: () => void;
}) {
  const on = !!share?.on;
  const url = share ? liveUrl(share.id) : "";
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!on || !url) return;
    QRCode.toDataURL(url, { margin: 1, width: 260, color: { dark: "#050a14", light: "#ffffff" } }).then(setQr).catch(() => setQr(""));
  }, [on, url]);

  const start = () => onShare({ id: share?.id ?? newLiveId(), on: true });
  const stop = async (thenNewLink = false) => {
    if (!share) return;
    setBusy(true); setErr(null);
    try { await unpublish(share.id); }
    catch (e) { setErr(`Could not take the old link down: ${(e as Error).message}`); }
    finally { setBusy(false); }
    onShare(thenNewLink ? { id: newLiveId(), on: true } : { ...share, on: false });
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { window.prompt("Copy this link:", url); }
  };
  const btn = (bg: string, color: string, border: string): React.CSSProperties =>
    ({ padding:"9px 14px", borderRadius:8, border:`1px solid ${border}`, background:bg, color, fontWeight:800, fontSize:14, cursor:"pointer" });

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:60, background:"rgba(3,7,16,.8)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Owners' phone link"
        style={{ background:"#07101e", border:"1px solid #1a2d50", borderRadius:16, padding:"20px 24px", width:"min(560px, 100%)", maxHeight:"92vh", overflowY:"auto", color:"#fff" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ fontSize:20, fontWeight:900, color:"#f0c040" }}>📱 Team owners' phone link</div>
          <button onClick={onClose} aria-label="Close" style={btn("transparent", "#90a4d4", "#1a2d50")}>✕</button>
        </div>

        {!liveConfigured() ? (
          <div style={{ fontSize:14, color:"#90a4d4", lineHeight:1.6 }}>
            Live phone links need a free Firebase project, which isn't set up for this site yet.
            <ol style={{ paddingLeft:20, margin:"10px 0" }}>
              <li>In the Firebase console, create a project and add a <b>Realtime Database</b>.</li>
              <li>Under Authentication → Sign-in method, enable <b>Anonymous</b>.</li>
              <li>In Realtime Database → Rules, paste the rules below and publish.</li>
              <li>Add the <code>VITE_FIREBASE_*</code> values (see <code>.env.example</code>) to the hosting settings and redeploy.</li>
            </ol>
            <pre style={{ background:"#030710", border:"1px solid #1a2d50", borderRadius:8, padding:10, fontSize:12, overflowX:"auto", color:"#c0d4f0" }}>{FIREBASE_RULES}</pre>
          </div>
        ) : !on ? (
          <div style={{ fontSize:15, color:"#90a4d4", lineHeight:1.6 }}>
            Owners open a link on their phone, pick their team, and follow the auction live: the player on the block, the current bid,
            their purse, max bid and squad. It's read-only and doesn't show players' mobile numbers.
            <div style={{ marginTop:14 }}>
              <button onClick={start} style={btn("#0a2818", "#30d158", "#1a4a2a")}>{share ? "▶ Resume sharing (same link)" : "▶ Start sharing"}</button>
            </div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ fontSize:14, fontWeight:800, color: status.ok ? "#30d158" : "#ff5f57" }}>
              {status.ok ? `● Live${status.at ? ` · updated ${timeAgo(status.at).toLowerCase()}` : " · connecting…"}` : `⚠ Not reaching Firebase: ${status.msg}`}
            </div>
            <div style={{ display:"flex", gap:16, flexWrap:"wrap", alignItems:"flex-start" }}>
              {qr && <img src={qr} alt="QR code for the owners' link" style={{ width:180, height:180, borderRadius:10, background:"#fff" }} />}
              <div style={{ flex:1, minWidth:200, display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ fontSize:13, color:"#6a80aa" }}>Owners scan the QR code or open this link:</div>
                <div style={{ fontSize:13, wordBreak:"break-all", background:"#030710", border:"1px solid #1a2d50", borderRadius:8, padding:"8px 10px", color:"#c0d4f0" }}>{url}</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button onClick={copy} style={btn("#2b1f00", "#f0c040", "#3a2800")}>{copied ? "✓ Copied" : "📋 Copy link"}</button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`Follow the auction live: ${url}`)}`} target="_blank" rel="noopener noreferrer"
                    style={{ ...btn("#0d2b0d", "#4caf50", "#1a4a2a"), textDecoration:"none" }}>WhatsApp</a>
                </div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", borderTop:"1px solid #1a2d50", paddingTop:12 }}>
              <button disabled={busy} onClick={() => stop(false)} style={btn("#1e0808", "#ff5f57", "#3a1010")}>■ Stop sharing</button>
              <button disabled={busy} onClick={() => { if (window.confirm("Make a new link? The old link stops working and owners will need the new one.")) void stop(true); }}
                style={btn("#0a1528", "#90a4d4", "#1a2d50")}>↻ New link</button>
            </div>
            <div style={{ fontSize:12, color:"#4a6080" }}>Anyone with the link can watch. Use "New link" if it reaches the wrong people.</div>
          </div>
        )}
        {err && <div style={{ marginTop:10, fontSize:13, color:"#ff8a80" }}>{err}</div>}
      </div>
    </div>
  );
}
