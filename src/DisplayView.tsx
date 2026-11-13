import { useState, useEffect } from "react";
import type React from "react";
import type { AuctionConfig, AuctionState } from "./types";
import { CONFIG_KEY, STATE_KEY, MANUAL_KEY, SUMMARY_KEY, ROLE_STYLE, UNCERTAIN_BADGE } from "./constants";
import { AuctionSummary } from "./components/AuctionSummary";
import { fmt, calcMax, squadFull, callSecs, bidWar, BID_WAR_MIN } from "./utils";
import { rdCfg, rdState, rdManual } from "./storage";
import { onDisplay, type DisplayEvent } from "./displayChannel";
import { PhotoAvatar } from "./components/PhotoAvatar";
import { DRAW_STEPS, DRAW_END } from "./sounds";

/* Audience screen for the projector (opened from the console's 📺 Display button, at /#display).
   Read-only: follows the operator window through localStorage, shows no contact details and no controls. */

const load = (): { cfg: AuctionConfig | null; st: AuctionState | null } => {
  const cfg = rdCfg();
  return { cfg, st: cfg ? rdState(cfg, rdManual(cfg.rules.defaultBasePrice)) : null };
};

const readSummary = () => { try { return localStorage.getItem(SUMMARY_KEY) === "1"; } catch { return false; } };

const toggleFullscreen = () => {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.().catch(() => {});
};

const initials = (name: string) => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

export function DisplayView() {
  const [{ cfg, st }, setData] = useState(load);
  const [event, setEvent] = useState<DisplayEvent | null>(null);
  const [going, setGoing] = useState<0 | 1 | 2>(0);
  const [showSummary, setShowSummary] = useState(readSummary);
  // Random draw: the name currently showing in the roll, and whether it has landed.
  const [draw, setDraw] = useState<{ name: string; serial?: number; done: boolean } | null>(null);

  // Fullscreen (button, F key or double-click) and an auto-hiding cursor/button for the projector.
  const [isFull, setIsFull] = useState(() => !!document.fullscreenElement);
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const toggle = toggleFullscreen;
    const onFs = () => setIsFull(!!document.fullscreenElement);
    const onKey = (e: KeyboardEvent) => { if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey && !e.altKey) toggle(); };
    let t: number | undefined;
    const wake = () => { setIdle(false); window.clearTimeout(t); t = window.setTimeout(() => setIdle(true), 2500); };
    wake();
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("keydown", onKey);
    window.addEventListener("dblclick", toggle);
    window.addEventListener("mousemove", wake);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("dblclick", toggle);
      window.removeEventListener("mousemove", wake);
      window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === STATE_KEY || e.key === CONFIG_KEY || e.key === MANUAL_KEY) setData(load());
      if (e.key === null || e.key === SUMMARY_KEY) setShowSummary(readSummary());
    };
    window.addEventListener("storage", onStorage);
    let timer: number | undefined;
    let rolls: number[] = [];
    const stopRoll = () => { rolls.forEach(window.clearTimeout); rolls = []; setDraw(null); };
    const off = onDisplay(e => {
      if (e.type === "going") { setGoing(e.stage); return; }
      if (e.type === "draw") {
        stopRoll();
        setGoing(0);
        setEvent(null);
        const last = DRAW_STEPS.length - 1;
        rolls = DRAW_STEPS.map((ms, k) => window.setTimeout(() =>
          setDraw(k === last ? { name: e.player, serial: e.serial, done: true } : { name: e.names[k % e.names.length], done: false }), ms));
        rolls.push(window.setTimeout(() => setDraw(null), DRAW_END + 1100));
        return;
      }
      stopRoll();
      setGoing(0);
      setEvent(e);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setEvent(null), e.type === "sold" ? 3200 : 2000);
    });
    return () => { window.removeEventListener("storage", onStorage); off(); window.clearTimeout(timer); rolls.forEach(window.clearTimeout); };
  }, []);

  if (!cfg || !st) {
    return (
      <div style={{ ...page, alignItems:"center", justifyContent:"center", fontSize:28, color:"#4a6080" }}>
        Waiting for the auction to start…
      </div>
    );
  }

  const fsButton = !idle && (
    <button onClick={toggleFullscreen} onDoubleClick={e => e.stopPropagation()} title="Fullscreen (F or double-click)"
      style={{ position:"fixed", right:18, bottom:18, zIndex:20, padding:"10px 16px", borderRadius:10, border:"1px solid #2a3d6a",
        background:"rgba(7,16,30,.9)", color:"#c0d4f0", fontSize:15, fontWeight:800, cursor:"pointer" }}>
      {isFull ? "✕ Exit fullscreen" : "⛶ Fullscreen"}
    </button>
  );

  if (showSummary) {
    return (
      <div style={{ ...page, cursor: idle ? "none" : "default" }}>
        <AuctionSummary config={cfg} players={st.players} teams={st.teams} projector />
        {fsButton}
      </div>
    );
  }

  const { rules } = cfg;
  const p = st.players[st.cur];
  const bids = st.bids ?? [];
  const lead = bids.length ? bids[bids.length - 1] : null;
  const leadTeam = lead ? st.teams[lead.team] : null;
  const war = p?.status === "available" ? bidWar(bids) : null;
  const warA = war ? st.teams[war.a] : undefined, warB = war ? st.teams[war.b] : undefined;
  const avail = p?.status === "available";
  const sold = st.players.filter(x => x.status === "sold").length;
  const remaining = st.players.filter(x => x.status === "available").length;
  const soldTeam = p?.soldTo ? st.teams.find(t => t.name === p.soldTo) : undefined;

  return (
    <div style={{ ...page, cursor: idle ? "none" : "default" }}>
      <style>{`
        @keyframes dvPop  { 0%{transform:scale(.4);opacity:0} 60%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
        @keyframes dvBid  { 0%{transform:translateY(-24px);opacity:0} 100%{transform:translateY(0);opacity:1} }
        @keyframes dvPuls { 0%{box-shadow:0 0 0 0 rgba(255,59,48,.7)} 70%{box-shadow:0 0 0 10px rgba(255,59,48,0)} 100%{box-shadow:0 0 0 0 rgba(255,59,48,0)} }
        .dv-pop{ animation: dvPop .4s cubic-bezier(.34,1.56,.64,1) forwards; }
        .dv-bid{ animation: dvBid .25s ease forwards; }
        .dv-puls{ animation: dvPuls 1.4s infinite; }
        @keyframes dvBar { from{width:100%} to{width:0%} }
        @keyframes dvWar { 0%,100%{box-shadow:0 0 18px rgba(255,120,40,.35)} 50%{box-shadow:0 0 42px rgba(255,120,40,.8)} }
        .dv-war{ animation: dvWar 1.1s ease-in-out infinite; }
        .dv-bar{ animation-name: dvBar; animation-timing-function: linear; animation-fill-mode: forwards; }
      `}</style>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, padding:"14px 28px", borderBottom:"1px solid #1a2d50", background:"#07101e", flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          {cfg.league.logo
            ? <img src={cfg.league.logo} alt="" style={{ height:56, width:56, objectFit:"contain", borderRadius:10 }} onError={e => (e.currentTarget.style.display = "none")} />
            : <div style={{ width:56, height:56, background:"#f0c040", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:20, color:"#050a14" }}>
                {cfg.league.name.split(" ").map(w => w[0]).join("").slice(0, 3).toUpperCase()}
              </div>}
          <div>
            <div style={{ fontSize:28, fontWeight:900, color:"#f0c040", lineHeight:1.1 }}>{cfg.league.name}</div>
            <div style={{ fontSize:15, color:"#6a80aa", letterSpacing:"2px", textTransform:"uppercase" }}>Player Auction {cfg.league.year}</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, background:"#1a0808", border:"1px solid #5a1010", borderRadius:20, padding:"5px 14px" }}>
            <div className="dv-puls" style={{ width:10, height:10, borderRadius:"50%", background:"#ff3b30" }} />
            <span style={{ fontSize:15, fontWeight:800, color:"#ff5f57", letterSpacing:"2px" }}>LIVE</span>
          </div>
        </div>
        <div style={{ display:"flex", gap:32 }}>
          {[{ l:"Sold", v:sold, c:"#30d158" }, { l:"Remaining", v:remaining, c:"#f0c040" }].map(x => (
            <div key={x.l} style={{ textAlign:"center" }}>
              <div style={{ fontSize:34, fontWeight:900, color:x.c, lineHeight:1 }}>{x.v}</div>
              <div style={{ fontSize:13, color:"#4a6080", textTransform:"uppercase", letterSpacing:"1px" }}>{x.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Player on the block */}
      <div style={{ flex:1, display:"grid", gridTemplateColumns:"minmax(0, 1.1fr) minmax(0, 1fr)", minHeight:0, position:"relative" }}>
        <div style={{ position:"relative", minHeight:320, borderRight:"1px solid #1a2d50" }}>
          {p && <div style={{ position:"absolute", inset:0 }}><PhotoAvatar photo={p.photo} name={p.name} card /></div>}
          {p && <div style={{ position:"absolute", top:16, left:16, background:"rgba(7,16,30,.8)", border:"1px solid #2a3d6a", borderRadius:10, padding:"6px 14px", fontSize:18, fontWeight:800, color:"#90a4d4", letterSpacing:"2px" }}>#{p.serialNo}</div>}
        </div>

        <div style={{ padding:"28px 36px", display:"flex", flexDirection:"column", justifyContent:"center", gap:26, background:"#060e1b", minWidth:0 }}>
          {p ? <>
            <div>
              <div style={{ fontSize:"clamp(36px, 4.2vw, 68px)", fontWeight:900, lineHeight:1.05, wordBreak:"break-word" }}>{p.name}</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:14 }}>
                <span style={{ ...chip, ...(ROLE_STYLE[p.role] ?? chipMuted) }}>{p.role}</span>
                <span style={{ ...chip, ...chipMuted }}>{p.batting}</span>
                {p.bowling !== "N/A" && <span style={{ ...chip, ...chipMuted }}>{p.bowling}</span>}
                {p.availabilityUncertain && <span style={{ ...chip, ...UNCERTAIN_BADGE }}>May/May Not Play</span>}
              </div>
              {p.city && p.city !== "—" && <div style={{ marginTop:12, fontSize:20, color:"#6a80aa" }}>{p.city}{p.state && p.state !== "—" ? `, ${p.state}` : ""}</div>}
            </div>

            <div style={{ display:"flex", gap:40, alignItems:"flex-end", flexWrap:"wrap" }}>
              <div>
                <div style={label}>Base price</div>
                <div style={{ fontSize:32, fontWeight:700, color:"#6a80aa" }}>{fmt(p.basePrice)}</div>
              </div>
              {avail && (
                <div>
                  <div style={label}>{lead ? "Current bid" : "Opening at"}</div>
                  <div key={`${st.cur}-${bids.length}`} className="dv-bid"
                    style={{ fontSize:"clamp(56px, 6.5vw, 110px)", fontWeight:900, color:"#f0c040", lineHeight:1, letterSpacing:-2, textShadow:"0 0 40px rgba(240,192,64,.45)" }}>
                    {fmt(p.currentBid)}
                  </div>
                </div>
              )}
            </div>

            {avail && (leadTeam ? (
              <div style={{ display:"inline-flex", alignSelf:"flex-start", alignItems:"center", gap:12, padding:"10px 22px", borderRadius:40,
                background:`${leadTeam.color}26`, border:`2px solid ${leadTeam.color}`, color:leadTeam.color, fontSize:28, fontWeight:900 }}>
                <span style={{ width:16, height:16, borderRadius:"50%", background:leadTeam.color }} />
                {leadTeam.name}
              </div>
            ) : (
              <div style={{ fontSize:24, color:"#4a6080", fontWeight:700 }}>Awaiting opening bid…</div>
            ))}

            {war && warA && warB && (
              <div key={war.count === BID_WAR_MIN ? "war-start" : "war"} className={war.count === BID_WAR_MIN ? "dv-pop dv-war" : "dv-war"}
                style={{ alignSelf:"flex-start", maxWidth:"100%", padding:"12px 22px", borderRadius:16, background:"linear-gradient(90deg, #2a0d05, #1a0806)", border:"2px solid #ff7a28" }}>
                <div style={{ fontSize:"clamp(20px, 2vw, 28px)", fontWeight:900, letterSpacing:5, color:"#ff9f43" }}>
                  🔥 BID WAR{war.count >= 8 ? " 🔥🔥" : war.count >= 6 ? " 🔥" : ""}
                </div>
                <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:"4px 14px", marginTop:4, fontSize:"clamp(24px, 2.6vw, 38px)", fontWeight:900 }}>
                  <span style={{ color:warA.color }}>{warA.name}</span>
                  <span style={{ color:"#ff7a28", fontSize:"0.8em" }}>⚔</span>
                  <span style={{ color:warB.color }}>{warB.name}</span>
                </div>
                <div style={{ marginTop:4, fontSize:18, color:"#c0a090", fontWeight:700 }}>
                  {war.count} bids · {fmt(war.from)} → {fmt(p.currentBid)}
                </div>
              </div>
            )}

            {avail && lead && going > 0 && (
              <div key={going} className="dv-pop" style={{ maxWidth:520 }}>
                <div style={{ fontSize:"clamp(34px, 3.6vw, 56px)", fontWeight:900, letterSpacing:4, color: going === 1 ? "#f0a030" : "#ff5f57",
                  textShadow:`0 0 30px ${going === 1 ? "#f0a03088" : "#ff5f5788"}` }}>
                  {going === 1 ? "GOING ONCE…" : "GOING TWICE…"}
                </div>
                {callSecs(rules) > 0 && (
                  <div style={{ height:6, background:"#111f3a", borderRadius:3, marginTop:8, overflow:"hidden" }}>
                    <div className="dv-bar" style={{ height:"100%", background: going === 1 ? "#f0a030" : "#ff5f57", animationDuration:`${callSecs(rules)}s` }} />
                  </div>
                )}
              </div>
            )}

            {!avail && p.status === "sold" && (
              <div style={{ fontSize:30, fontWeight:900, color:soldTeam?.color ?? "#30d158" }}>SOLD to {p.soldTo} · {fmt(p.soldPrice ?? 0)}</div>
            )}
            {!avail && p.status === "unsold" && <div style={{ fontSize:30, fontWeight:900, color:"#ff5f57" }}>UNSOLD</div>}

            {avail && bids.length > 1 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {bids.slice(0, -1).reverse().slice(0, 6).map((b, k) => {
                  const t = st.teams[b.team];
                  return (
                    <span key={k} style={{ fontSize:15, padding:"5px 12px", borderRadius:20, background:"#0a1528", border:`1px solid ${t?.color ?? "#1a2d50"}55`, color:"#90a4d4", fontWeight:700 }}>
                      <span style={{ color:t?.color }}>{t?.name}</span> · {fmt(b.amount)}
                    </span>
                  );
                })}
              </div>
            )}
          </> : <div style={{ fontSize:28, color:"#4a6080" }}>Next player coming up…</div>}
        </div>

        {/* SOLD / UNSOLD / UNSOLD ROUND announcement */}
        {event && (
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16,
            background: event.type === "sold" ? `${event.color}40` : "rgba(3,7,16,.7)", backdropFilter:"blur(6px)" }}>
            {(() => {
              const color = event.type === "sold" ? event.color : event.type === "unsold" ? "#ff5f57" : "#f0c040";
              const text  = event.type === "sold" ? "SOLD!" : event.type === "unsold" ? "UNSOLD" : "UNSOLD ROUND";
              return <div className="dv-pop" style={{ fontSize:"clamp(80px, 11vw, 180px)", fontWeight:900, letterSpacing:6, color, textShadow:`0 0 60px ${color}` }}>{text}</div>;
            })()}
            {event.type === "sold" && (
              <div className="dv-pop" style={{ fontSize:"clamp(26px, 3vw, 44px)", fontWeight:800, textAlign:"center", padding:"0 24px", textShadow:"0 2px 10px rgba(0,0,0,.8)" }}>
                {event.player} → <span style={{ color:event.color }}>{event.team}</span> · {fmt(event.price)}
              </div>
            )}
            {event.type === "unsold" && <div style={{ fontSize:32, fontWeight:700, color:"#c0d4f0" }}>{event.player}</div>}
          </div>
        )}

        {/* Random draw: names roll, slow down, and land on the drawn player */}
        {draw && (
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:18,
            background: draw.done ? "rgba(3,7,16,.55)" : "rgba(3,7,16,.88)", backdropFilter:"blur(8px)", transition:"background .4s" }}>
            <div style={{ fontSize:"clamp(22px, 2.4vw, 34px)", fontWeight:800, letterSpacing:6, color:"#6a80aa", textTransform:"uppercase" }}>🎲 Random draw</div>
            <div key={draw.done ? "done" : "roll"} className={draw.done ? "dv-pop" : undefined}
              style={{ fontSize:"clamp(48px, 6vw, 100px)", fontWeight:900, textAlign:"center", padding:"0 24px", lineHeight:1.1,
                color: draw.done ? "#f0c040" : "#c0d4f0", textShadow: draw.done ? "0 0 50px rgba(240,192,64,.6)" : "none" }}>
              {draw.done && draw.serial !== undefined && <span style={{ color:"#90a4d4" }}>#{draw.serial} </span>}{draw.name}
            </div>
          </div>
        )}
      </div>

      {/* Team purses */}
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(st.teams.length, 8)}, minmax(0, 1fr))`, gap:10, padding:"14px 20px", borderTop:"1px solid #1a2d50", background:"#07101e" }}>
        {st.teams.map((t, i) => {
          const leading = avail && lead?.team === i;
          const full = squadFull(t, rules);
          return (
            <div key={t.name} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:12, minWidth:0,
              border:`2px solid ${leading ? t.color : "#1a2d50"}`, background: leading ? `${t.color}22` : "#06101e",
              boxShadow: leading ? `0 0 24px ${t.color}66` : "none", transition:"all .2s" }}>
              <div style={{ width:38, height:38, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
                background:`${t.color}33`, border:`2px solid ${t.color}`, color:t.color, fontWeight:900, fontSize:14 }}>{initials(t.name)}</div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:16, fontWeight:800, color:t.color, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.name}</div>
                <div style={{ fontSize:20, fontWeight:900, color:"#fff" }}>{fmt(t.purse)}</div>
                <div style={{ fontSize:13, color:"#6a80aa" }}>{t.players.length}{rules.maxPlayers ? `/${rules.maxPlayers}` : ""} players{t.players.length < rules.minPlayers ? ` · need ${rules.minPlayers - t.players.length}` : ""}</div>
                <div style={{ fontSize:13, color: full ? "#ff5f57" : "#6a80aa", fontWeight: full ? 800 : 400 }}>
                  {full ? "SQUAD FULL" : `max bid ${fmt(calcMax(t, rules.minPlayers, rules.defaultBasePrice))}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {fsButton}
    </div>
  );
}

const page: React.CSSProperties = {
  background:"#030710", color:"#fff", height:"100vh", textAlign:"left", lineHeight:1.25, display:"flex", flexDirection:"column", overflow:"hidden",
  fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
};
const chip: React.CSSProperties = { fontSize:18, padding:"5px 14px", borderRadius:20, fontWeight:700 };
const chipMuted: React.CSSProperties = { background:"#1a2d50", color:"#8899bb", border:"1px solid #2a3d6a" };
const label: React.CSSProperties = { fontSize:14, color:"#4a6080", textTransform:"uppercase", letterSpacing:"1.5px", marginBottom:6 };
