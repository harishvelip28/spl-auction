import { useEffect, useRef, useState } from "react";
import type React from "react";
import { subscribe, type LiveSnapshot, type LiveTeam } from "./live";
import { fmt, calcMax, canAfford, bidStepAt, squadFull, bidWar } from "./utils";
import { ROLE_STYLE } from "./constants";
import { PhotoAvatar } from "./components/PhotoAvatar";

/* Team owner's phone view at /#live/<id>: read-only, no login. The owner picks their team once
   (remembered on the phone) and sees the live player, the bid, their purse/max bid and squad. */

const initials = (name: string) => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
const WATCH = "__watch__";

export function OwnerView({ id }: { id: string }) {
  const [snap, setSnap] = useState<LiveSnapshot | null | undefined>(undefined);   // undefined = loading
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const teamKey = `auction-owner-team:${id}`;
  const [myName, setMyName] = useState<string | null>(() => { try { return localStorage.getItem(teamKey); } catch { return null; } });
  const pickTeam = (name: string | null) => {
    setMyName(name);
    try { if (name) localStorage.setItem(teamKey, name); else localStorage.removeItem(teamKey); } catch { /* remembered for this visit only */ }
  };

  useEffect(() => subscribe(id, { data: setSnap, connected: setConnected, error: setError }), [id]);

  // Buzz the phone when my team loses the lead (Android; iPhones ignore vibrate).
  const prevLead = useRef<string | null>(null);
  const lead = snap?.bids.length ? snap.teams[snap.bids[snap.bids.length - 1].team]?.name ?? null : null;
  useEffect(() => {
    if (prevLead.current === myName && lead && lead !== myName) navigator.vibrate?.(200);
    prevLead.current = lead;
  }, [lead, myName]);

  if (error && snap === undefined) return <Centered title="Can't connect" text={`The live feed could not be reached. Check your internet and reload.\n(${error})`} />;
  if (snap === undefined) return <Centered title="Connecting…" text="Loading the live auction." />;
  if (snap === null) return <Centered title="Not live right now" text="This auction link isn't sharing at the moment. Ask the auction desk for the current link, or keep this page open — it updates by itself." />;

  const { rules, teams, player: p, bids } = snap;
  const my = myName && myName !== WATCH ? teams.find(t => t.name === myName) ?? null : null;
  if (!myName || (myName !== WATCH && !my)) return <TeamPicker snap={snap} onPick={pickTeam} />;

  const avail = p?.status === "available";
  const leadBid = avail && bids.length ? bids[bids.length - 1] : null;
  const leadTeam = leadBid ? teams[leadBid.team] : null;
  const iLead = !!my && leadTeam?.name === my.name;
  const nextBid = !p ? 0 : leadBid ? p.currentBid + bidStepAt(p.currentBid, rules) : p.basePrice;
  const war = avail ? bidWar(bids) : null;
  const soldTeam = p?.soldTo ? teams.find(t => t.name === p.soldTo) : undefined;
  const maxOf = (t: LiveTeam) => calcMax(t, rules.minPlayers, rules.defaultBasePrice);

  let myStatus: { text: string; color: string; bg: string } | null = null;
  if (my && avail) {
    if (iLead) myStatus = { text: "✅ You hold the bid", color: "#30d158", bg: "#0a2818" };
    else if (squadFull(my, rules)) myStatus = { text: `Squad full (${rules.maxPlayers} players) — you can't bid`, color: "#ff5f57", bg: "#1e0808" };
    else if (!canAfford(my, nextBid, rules.minPlayers, rules.defaultBasePrice)) myStatus = { text: `Next bid ${fmt(nextBid)} is over your max ${fmt(maxOf(my))}`, color: "#ff5f57", bg: "#1e0808" };
    else myStatus = { text: `You can bid ${fmt(nextBid)} · your max ${fmt(maxOf(my))}`, color: "#f0c040", bg: "#1a1000" };
  }

  return (
    <div style={page}>
      <style>{`
        @keyframes ovPuls { 0%{box-shadow:0 0 0 0 rgba(48,209,88,.7)} 70%{box-shadow:0 0 0 7px rgba(48,209,88,0)} 100%{box-shadow:0 0 0 0 rgba(48,209,88,0)} }
        @keyframes ovPop { 0%{transform:scale(.85);opacity:0} 100%{transform:scale(1);opacity:1} }
        .ov-pop{ animation: ovPop .25s ease-out; }
        *{ box-sizing:border-box; }
      `}</style>
      <div style={{ maxWidth:560, margin:"0 auto", padding:"12px 16px 32px", display:"flex", flexDirection:"column", gap:12 }}>

        {/* Top bar */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:17, fontWeight:900, color:"#f0c040", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{snap.league.name} {snap.league.year}</div>
            <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:800, color: connected ? "#30d158" : "#ff9f43" }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background: connected ? "#30d158" : "#ff9f43", animation: connected ? "ovPuls 1.6s infinite" : undefined }} />
              {connected ? "LIVE" : "Reconnecting…"}
              <span style={{ color:"#4a6080", fontWeight:600 }}>· {snap.counts.sold} sold · {snap.counts.remaining} left</span>
            </div>
          </div>
          <button onClick={() => pickTeam(null)} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 10px", borderRadius:20, cursor:"pointer", flexShrink:0,
            border:`1px solid ${my ? my.color : "#2a3d6a"}`, background: my ? `${my.color}22` : "#0a1528", color: my ? my.color : "#90a4d4", fontWeight:800, fontSize:13 }}>
            {my ? my.name : "Watching"} <span style={{ color:"#6a80aa", fontWeight:600 }}>· change</span>
          </button>
        </div>

        {/* Player on the block */}
        {p ? (
          <div style={card}>
            <div style={{ display:"flex", gap:14 }}>
              <div style={{ width:96, height:120, borderRadius:12, overflow:"hidden", flexShrink:0, border:"1px solid #1a2d50", position:"relative" }}>
                <PhotoAvatar photo={p.photo} name={p.name} card />
              </div>
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ fontSize:12, color:"#6a80aa", fontWeight:700 }}>#{p.serialNo} · base {fmt(p.basePrice)}</div>
                <div style={{ fontSize:22, fontWeight:900, lineHeight:1.15, marginTop:2, wordBreak:"break-word" }}>{p.name}</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:8 }}>
                  <span style={{ ...chip, ...(ROLE_STYLE[p.role] ?? chipMuted) }}>{p.role}</span>
                  <span style={{ ...chip, ...chipMuted }}>{p.batting}</span>
                  {p.bowling !== "N/A" && <span style={{ ...chip, ...chipMuted }}>{p.bowling}</span>}
                </div>
                {p.city && p.city !== "—" && <div style={{ fontSize:13, color:"#6a80aa", marginTop:6 }}>{p.city}{p.state && p.state !== "—" ? `, ${p.state}` : ""}</div>}
              </div>
            </div>

            {avail && (
              <div style={{ marginTop:14 }}>
                <div style={lbl}>{leadTeam ? "Current bid" : "Opening at"}</div>
                <div key={bids.length} className="ov-pop" style={{ fontSize:40, fontWeight:900, color:"#f0c040", lineHeight:1.05 }}>{fmt(p.currentBid)}</div>
                {leadTeam ? (
                  <div style={{ display:"inline-flex", alignItems:"center", gap:8, marginTop:8, padding:"5px 12px", borderRadius:20,
                    background:`${leadTeam.color}22`, border:`1px solid ${leadTeam.color}`, color:leadTeam.color, fontWeight:900, fontSize:15 }}>
                    <span style={{ width:9, height:9, borderRadius:"50%", background:leadTeam.color }} />{leadTeam.name}
                  </div>
                ) : <div style={{ marginTop:6, fontSize:14, color:"#4a6080", fontWeight:700 }}>Awaiting opening bid…</div>}
              </div>
            )}

            {avail && snap.going > 0 && (
              <div key={snap.going} className="ov-pop" style={{ marginTop:12, fontSize:22, fontWeight:900, letterSpacing:2, color: snap.going === 1 ? "#f0a030" : "#ff5f57" }}>
                {snap.going === 1 ? "GOING ONCE…" : "GOING TWICE…"}
              </div>
            )}

            {war && (
              <div style={{ marginTop:12, padding:"8px 12px", borderRadius:10, background:"#2a0d05", border:"1px solid #ff7a28", fontWeight:800, fontSize:14, color:"#ff9f43" }}>
                🔥 BID WAR · {war.count} bids<br />
                <span style={{ color:teams[war.a]?.color }}>{teams[war.a]?.name}</span> ⚔ <span style={{ color:teams[war.b]?.color }}>{teams[war.b]?.name}</span>
              </div>
            )}

            {p.status === "sold" && (
              <div className="ov-pop" style={{ marginTop:14, padding:"10px 12px", borderRadius:10, background:`${soldTeam?.color ?? "#30d158"}22`, border:`1px solid ${soldTeam?.color ?? "#30d158"}`,
                fontSize:18, fontWeight:900, color:soldTeam?.color ?? "#30d158" }}>
                {my && p.soldTo === my.name ? "🎉 Yours! " : "SOLD "}to {p.soldTo} · {fmt(p.soldPrice ?? 0)}
              </div>
            )}
            {p.status === "unsold" && <div style={{ marginTop:14, fontSize:18, fontWeight:900, color:"#ff5f57" }}>UNSOLD</div>}

            {myStatus && (
              <div style={{ marginTop:12, padding:"9px 12px", borderRadius:10, background:myStatus.bg, color:myStatus.color, fontWeight:800, fontSize:14 }}>{myStatus.text}</div>
            )}
          </div>
        ) : <div style={{ ...card, color:"#4a6080", textAlign:"center", fontWeight:700 }}>Next player coming up…</div>}

        {/* My team */}
        {my && (
          <div style={{ ...card, borderTop:`4px solid ${my.color}` }}>
            <div style={{ fontSize:16, fontWeight:900, color:my.color }}>{my.name}</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8, marginTop:10 }}>
              {[
                { l:"Purse left", v:fmt(my.purse), c:"#fff" },
                { l:"Max bid",    v:squadFull(my, rules) ? "Full" : fmt(maxOf(my)), c:"#f0c040" },
                { l:"Players",    v:`${my.players.length}${rules.maxPlayers ? `/${rules.maxPlayers}` : ""}`, c: my.players.length >= rules.minPlayers ? "#30d158" : "#90a4d4" },
              ].map(x => (
                <div key={x.l} style={{ background:"#0a1528", borderRadius:10, padding:"8px 6px", textAlign:"center", minWidth:0 }}>
                  <div style={{ fontSize:16, fontWeight:900, color:x.c, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{x.v}</div>
                  <div style={{ fontSize:11, color:"#4a6080", textTransform:"uppercase", letterSpacing:".5px", marginTop:2 }}>{x.l}</div>
                </div>
              ))}
            </div>
            {my.players.length < rules.minPlayers && (
              <div style={{ fontSize:13, color:"#6a80aa", marginTop:8 }}>Need {rules.minPlayers - my.players.length} more to reach the minimum of {rules.minPlayers}.</div>
            )}
            <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:6 }}>
              {my.players.length === 0 && <div style={{ fontSize:14, color:"#4a6080" }}>No players bought yet.</div>}
              {[...my.players].sort((a, b) => b.soldPrice - a.soldPrice).map(x => (
                <div key={x.serialNo} style={{ display:"flex", justifyContent:"space-between", gap:10, fontSize:14 }}>
                  <span style={{ minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{x.name} <span style={{ color:"#4a6080", fontSize:12 }}>{x.role}</span></span>
                  <span style={{ fontWeight:800, color:"#f0c040", whiteSpace:"nowrap" }}>{fmt(x.soldPrice)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All teams */}
        <div style={card}>
          <div style={lbl}>All teams</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:6 }}>
            {teams.map(t => {
              const full = squadFull(t, rules);
              const mine = my?.name === t.name;
              return (
                <div key={t.name} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 8px", borderRadius:10, background: mine ? `${t.color}18` : "transparent" }}>
                  <div style={{ width:30, height:30, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
                    background:`${t.color}33`, border:`2px solid ${t.color}`, color:t.color, fontWeight:900, fontSize:11 }}>{initials(t.name)}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:800, color:t.color, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.name}</div>
                    <div style={{ fontSize:12, color:"#6a80aa" }}>{t.players.length} players · {full ? <b style={{ color:"#ff5f57" }}>full</b> : `max ${fmt(maxOf(t))}`}</div>
                  </div>
                  <div style={{ fontSize:15, fontWeight:900, whiteSpace:"nowrap" }}>{fmt(t.purse)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recently sold */}
        {snap.recent.length > 0 && (
          <div style={card}>
            <div style={lbl}>Recently sold</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:6 }}>
              {snap.recent.map((a, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", gap:10, fontSize:14 }}>
                  <span style={{ minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.playerName} → <b style={{ color:a.teamColor }}>{a.teamName}</b></span>
                  <span style={{ fontWeight:800, color:"#f0c040", whiteSpace:"nowrap" }}>{fmt(a.price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamPicker({ snap, onPick }: { snap: LiveSnapshot; onPick: (name: string) => void }) {
  return (
    <div style={page}>
      <div style={{ maxWidth:560, margin:"0 auto", padding:"28px 16px" }}>
        <div style={{ fontSize:20, fontWeight:900, color:"#f0c040" }}>{snap.league.name} {snap.league.year}</div>
        <div style={{ fontSize:24, fontWeight:900, marginTop:14 }}>Which team are you?</div>
        <div style={{ fontSize:14, color:"#6a80aa", marginTop:4 }}>We'll show your purse, max bid and squad. You can change this later.</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))", gap:10, marginTop:18 }}>
          {snap.teams.map(t => (
            <button key={t.name} onClick={() => onPick(t.name)}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 12px", borderRadius:12, cursor:"pointer", textAlign:"left",
                border:`2px solid ${t.color}`, background:`${t.color}18`, color:t.color, fontWeight:900, fontSize:15 }}>
              <span style={{ width:32, height:32, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
                background:`${t.color}33`, fontSize:12 }}>{initials(t.name)}</span>
              <span style={{ minWidth:0, wordBreak:"break-word" }}>{t.name}</span>
            </button>
          ))}
        </div>
        <button onClick={() => onPick(WATCH)}
          style={{ marginTop:16, width:"100%", padding:"12px", borderRadius:12, border:"1px solid #2a3d6a", background:"#0a1528", color:"#90a4d4", fontWeight:800, fontSize:15, cursor:"pointer" }}>
          👀 Just watching
        </button>
      </div>
    </div>
  );
}

function Centered({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ ...page, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ maxWidth:420, textAlign:"center" }}>
        <div style={{ fontSize:22, fontWeight:900, color:"#f0c040" }}>{title}</div>
        <div style={{ fontSize:15, color:"#90a4d4", marginTop:10, whiteSpace:"pre-line", lineHeight:1.5 }}>{text}</div>
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  background:"#030710", color:"#fff", minHeight:"100vh", textAlign:"left", lineHeight:1.3,
  fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
};
const card: React.CSSProperties = { background:"#07101e", border:"1px solid #1a2d50", borderRadius:14, padding:14 };
const chip: React.CSSProperties = { fontSize:12, padding:"2px 9px", borderRadius:20, fontWeight:700 };
const chipMuted: React.CSSProperties = { background:"#1a2d50", color:"#8899bb", border:"1px solid #2a3d6a" };
const lbl: React.CSSProperties = { fontSize:11, color:"#4a6080", textTransform:"uppercase", letterSpacing:"1px", fontWeight:700 };
