import React, { useState, useEffect } from "react";
import type { Status, Player, Team, AuctionConfig, ActivityEntry, Bid } from "./types";
import { ROLE_STYLE, UNCERTAIN_BADGE, MANUAL_BADGE, SUMMARY_KEY } from "./constants";
import html2canvas from "html2canvas";
import { AuctionSummary } from "./components/AuctionSummary";
import { fmt, playerKey, mergePlayers, timeAgo, canAfford, calcMax, bidStepAt, squadFull, callSecs, bidWar, BID_WAR_MIN } from "./utils";
import { rdState, wrState, rdManual, wrManual, downloadBackup } from "./storage";
import { RestoreButton } from "./components/RestoreButton";
import { PhotoAvatar } from "./components/PhotoAvatar";
import { UserBadge } from "./components/UserBadge";
import { TeamRoster } from "./components/TeamRoster";
import { AddPlayerModal } from "./components/AddPlayerModal";
import { sendDisplay } from "./displayChannel";
import { play, soundOn, setSoundOn } from "./sounds";
import { ShortcutHelp } from "./components/ShortcutHelp";

type View = "auction" | "players" | "summary";
const readView = (): View => (window.location.hash === "#players" ? "players" : window.location.hash === "#summary" ? "summary" : "auction");

export function AuctionApp({ config, initPlayers, onSetup, user }: {
  config: AuctionConfig;
  user: string | null;
  initPlayers: Player[];
  onSetup: () => void;
}) {
  const { rules } = config;
  const [manualPlayers, setManualPlayers] = useState<Player[]>(() => rdManual(rules.defaultBasePrice));
  const [initState] = useState(() => rdState(config, rdManual(rules.defaultBasePrice)));

  const [players, setPlayers]  = useState<Player[]>(() => initState?.players ?? initPlayers);
  const [teams,   setTeams]    = useState<Team[]>(() => initState?.teams ?? config.teams.map(t => ({ ...t, purse: rules.totalPurse, players: [] })));
  const [cur,     setCur]      = useState(() => initState?.cur ?? 0);
  const [selTeam, setSelTeam]  = useState(() => initState?.selTeam ?? 0);
  const [overlay, setOverlay]  = useState<{ text: string; price?: string; teamColor?: string } | null>(null);
  const [filter,  setFilter]   = useState("all");
  const [search,  setSearch]   = useState("");
  const [bidKey,  setBidKey]   = useState(0);
  const [showRoster,    setShowRoster]    = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [activity,      setActivity]      = useState<ActivityEntry[]>(() => initState?.activity ?? []);
  const [lastSnapshot,  setLastSnapshot]  = useState<{ players: Player[]; teams: Team[]; bids: Bid[]; activity: ActivityEntry[] } | null>(null);
  // Bids on the player currently on auction. Older saves have no bid log: if their current
  // player was already raised, treat the selected team as the bidder.
  const [bids, setBids] = useState<Bid[]>(() => {
    if (initState?.bids) return initState.bids;
    const p0 = initState?.players[initState.cur];
    return initState && p0 && p0.status === "available" && p0.currentBid > p0.basePrice
      ? [{ team: initState.selTeam, amount: p0.currentBid, at: Date.now() }] : [];
  });
  // Auctioneer's call: 0 idle, 1 "going once", 2 "going twice" → then SOLD automatically.
  const [going, setGoing] = useState<0 | 1 | 2>(0);
  const [sound, setSound] = useState(soundOn);
  const toggleSound = () => { const on = !sound; setSound(on); setSoundOn(on); notify(on ? "🔊 Sound on" : "🔇 Sound off"); };
  const [showHelp, setShowHelp] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = React.useRef<number | undefined>(undefined);
  const notify = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  };
  const [saveFailed,    setSaveFailed]    = useState(false);
  const [saveWarnClosed, setSaveWarnClosed] = useState(false);

  // Players fetched by the root after this screen mounted (fresh start, nothing saved yet)
  useEffect(() => {
    if (!players.length && initPlayers.length) setPlayers(initPlayers);
  }, [initPlayers]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Page: auction screen or full player list. Synced to the URL hash so browser Back works.
  const [view, setView] = useState<View>(readView);
  useEffect(() => {
    const onHash = () => setView(readView());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const goTo = (v: View) => {
    if (v !== "auction") window.location.hash = v;
    else history.pushState(null, "", window.location.pathname + window.location.search);
    setView(v);
    window.scrollTo(0, 0);
  };

  // Persist state after every change so a crash/restart resumes exactly here
  useEffect(() => {
    const ok = wrState({ players, teams, cur, selTeam, activity, bids });
    setSaveFailed(!ok);
    if (ok) setSaveWarnClosed(false); // a later failure shows the warning again
  }, [players, teams, cur, selTeam, activity, bids]);
  const backup = () => downloadBackup(config, { players, teams, cur, selTeam, activity, bids }, manualPlayers);
  // Auction summary: shown on the projector while this flag is set (the display window watches localStorage).
  const [summaryOnProj, setSummaryOnProj] = useState(() => { try { return localStorage.getItem(SUMMARY_KEY) === "1"; } catch { return false; } });
  const setProjSummary = (on: boolean) => {
    setSummaryOnProj(on);
    try { if (on) localStorage.setItem(SUMMARY_KEY, "1"); else localStorage.removeItem(SUMMARY_KEY); } catch { notify("Could not reach the projector window (browser storage blocked)."); }
  };
  const summaryRef = React.useRef<HTMLDivElement>(null);
  async function downloadSummary() {
    if (!summaryRef.current) return;
    try {
      const canvas = await html2canvas(summaryRef.current, { backgroundColor:"#030710", scale:2, useCORS:true, logging:false });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${config.league.name.replace(/[^\w]+/g, "_")}_auction_summary.png`;
      a.click();
    } catch { notify("Could not create the image."); }
  }
  const openDisplay = () => window.open(window.location.pathname + window.location.search + "#display", "spl-auction-display");

  const p      = players[cur];
  const avail  = p?.status === "available";
  const lead   = bids.length ? bids[bids.length - 1] : null;
  const leadTeam = lead ? teams[lead.team] : null;
  const nextBid  = !p ? 0 : lead ? p.currentBid + bidStepAt(p.currentBid, rules) : p.basePrice;
  const war    = avail ? bidWar(bids) : null;
  const canLow = !!p && avail && bids.length > 0;
  const canUns = !!p && avail && bids.length === 0;
  const canNav = !p || !avail || bids.length === 0;
  const sold     = players.filter(x => x.status === "sold").length;
  const unsold   = players.filter(x => x.status === "unsold").length;
  const remaining = players.filter(x => x.status === "available").length;
  const maxBid = (t: Team) => calcMax(t, rules.minPlayers, rules.defaultBasePrice);

  /** Team i raises its paddle: opening bid is the base price, then +bidStep each time. */
  function teamBid(i: number) {
    if (!p || !avail) return;
    const t = teams[i];
    if (lead?.team === i) { notify(`${t.name} already holds the bid at ${fmt(p.currentBid)}`); return; }
    if (squadFull(t, rules)) { notify(`${t.name} already has the maximum ${rules.maxPlayers} players`); return; }
    if (!canAfford(t, nextBid, rules.minPlayers, rules.defaultBasePrice)) {
      notify(`${t.name} cannot bid ${fmt(nextBid)} — max bid is ${fmt(maxBid(t))}`);
      return;
    }
    setPlayers(prev => prev.map((pl,k) => k===cur ? { ...pl, currentBid:nextBid } : pl));
    const nb = [...bids, { team:i, amount:nextBid, at:Date.now() }];
    setBids(nb);
    setGoing(0);
    setSelTeam(i);
    setBidKey(k => k+1);
    play(bidWar(nb)?.count === BID_WAR_MIN ? "war" : "bid");   // fanfare once, when the war breaks out
  }
  /** Take back the most recent bid (mistaken click, or the team withdraws it). */
  function retractBid() {
    if (!p || !avail || !bids.length) return;
    const rest = bids.slice(0, -1);
    const prev = rest[rest.length - 1];
    setPlayers(ps => ps.map((pl,k) => k===cur ? { ...pl, currentBid: prev ? prev.amount : pl.basePrice } : pl));
    setBids(rest);
    setGoing(0);
    if (prev) setSelTeam(prev.team);
    setBidKey(k => k+1);
  }
  function markSold() {
    if (!p || !avail) return;
    if (!lead || !leadTeam) { notify("No bids yet — click a team to place the opening bid."); return; }
    const bt = leadTeam, ti = lead.team;
    setGoing(0);
    if (bt.purse < p.currentBid) { notify(`${bt.name} doesn't have enough purse (${fmt(bt.purse)})`); return; }
    if (squadFull(bt, rules)) { notify(`${bt.name} already has the maximum ${rules.maxPlayers} players`); return; }
    setLastSnapshot({ players, teams, bids, activity });
    const upd: Player = { ...p, status:"sold", soldTo:bt.name, soldPrice:p.currentBid };
    setPlayers(prev => prev.map((pl,i) => i===cur ? upd : pl));
    setTeams(prev => prev.map((t,i) => i!==ti ? t : { ...t, purse:t.purse-p.currentBid, players:[...t.players, upd] }));
    if (bt.players.length + 1 === rules.minPlayers) setTimeout(() => notify(`🎉 ${bt.name} completed their team with ${rules.minPlayers} players!`), 2600);
    setBids([]);
    setActivity(prev => [{ playerName:p.name, teamName:bt.name, teamColor:bt.color, price:p.currentBid, soldAt:Date.now() }, ...prev].slice(0, 8));
    setOverlay({ text:"SOLD!", price:`${fmt(p.currentBid)}  →  ${bt.name}`, teamColor:bt.color });
    sendDisplay({ type:"sold", player:p.name, team:bt.name, color:bt.color, price:p.currentBid });
    play("sold");
    setTimeout(() => setOverlay(null), 2500);
  }
  /** Going once → going twice → SOLD. Pressing again skips ahead; a new bid cancels it. */
  function callGoing() {
    if (!p || !avail) return;
    if (!lead) { notify("No bids yet — nothing to call."); return; }
    if (going === 2) markSold(); else setGoing(going === 0 ? 1 : 2);
  }
  function markUnsold() {
    if (!p || !avail) return;
    if (bids.length) { notify("Cannot mark unsold after a bid — retract the bids first."); return; }
    setLastSnapshot({ players, teams, bids, activity });
    setPlayers(prev => prev.map((pl,i) => i===cur ? { ...pl, status:"unsold" } : pl));
    setOverlay({ text:"UNSOLD" });
    sendDisplay({ type:"unsold", player:p.name });
    play("unsold");
    setTimeout(() => setOverlay(null), 1500);
  }
  function undoLast() {
    if (!lastSnapshot) return;
    setPlayers(lastSnapshot.players);
    setTeams(lastSnapshot.teams);
    setBids(lastSnapshot.bids);
    setGoing(0);
    setActivity(lastSnapshot.activity);
    setLastSnapshot(null);
    setOverlay(null);
  }
  function nextPlayer() {
    if (!canNav) { notify("Bidding is open — mark the player SOLD (or retract the bids) first."); return; }
    const next = players.findIndex((x,i) => i>cur && x.status==="available");
    const fall = players.findIndex(x => x.status==="available");
    const idx  = next!==-1 ? next : fall;
    if (idx !== -1) { setCur(idx); setOverlay(null); return; }
    const hasUnsold = players.some(pl => pl.status==="unsold");
    if (hasUnsold) {
      const re = players.map(pl => pl.status==="unsold" ? { ...pl, status:"available" as Status, currentBid:pl.basePrice, soldTo:undefined, soldPrice:undefined } : pl);
      const fi = re.findIndex(pl => pl.status==="available");
      setPlayers(re); setCur(fi!==-1?fi:0);
      setOverlay({ text:"RE-AUCTION" });
      sendDisplay({ type:"reauction" });
      setTimeout(() => setOverlay(null), 1800);
      return;
    }
    notify("Auction complete. No available players left.");
  }
  function prevPlayer() {
    if (!canNav) { notify("Bidding is open — mark the player SOLD (or retract the bids) first."); return; }
    let prev = -1;
    for (let i=cur-1; i>=0; i--) { if (players[i].status==="available") { prev=i; break; } }
    if (prev===-1) for (let i=players.length-1; i>=0; i--) { if (players[i].status==="available") { prev=i; break; } }
    if (prev !== -1) { setCur(prev); setOverlay(null); return; }
    notify("No available players.");
  }
  /** Draw a random available player (not the one on the block); the projector shows a rolling reveal. */
  function randomPlayer() {
    if (!canNav) { notify("Bidding is open — mark the player SOLD (or retract the bids) first."); return; }
    const pool = players.map((_,i) => i).filter(i => i !== cur && players[i].status === "available");
    if (!pool.length) {
      if (avail) notify(`${p!.name} is the last available player.`);
      else nextPlayer();   // nothing left: same as NEXT (offers the unsold players again)
      return;
    }
    const idx = pool[Math.floor(Math.random() * pool.length)];
    const pick = players[idx];
    const names = pool.filter(i => i !== idx).sort(() => Math.random() - .5).slice(0, 20).map(i => players[i].name);
    setCur(idx); setOverlay(null);
    sendDisplay({ type:"draw", names: names.length ? names : [pick.name], player: pick.name, serial: pick.serialNo });
    play("draw");
    notify(`🎲 Drew #${pick.serialNo} ${pick.name}`);
  }
  function openSetup() {
    if (!window.confirm("⚙ Open Setup while the auction is live?\n\nLaunching the auction again from Setup will reset all bids and team assignments.")) return;
    onSetup();
  }
  function resetAll() {
    if (!window.confirm("🔄 Reset all bids and team assignments?\n\nThis cannot be undone.")) return;
    const rp = players.map(pl => ({ ...pl, status:"available" as Status, currentBid:pl.basePrice, soldTo:undefined, soldPrice:undefined }));
    const rt = config.teams.map(t => ({ ...t, purse:rules.totalPurse, players:[] }));
    setPlayers(rp); setTeams(rt); setCur(0); setSelTeam(0); setOverlay(null); setFilter("all"); setActivity([]); setLastSnapshot(null); setBids([]); setGoing(0);
  }
  function deletePlayer() {
    if (!p) return;
    const stIdx = p.soldTo ? teams.findIndex(t => t.name===p.soldTo) : -1;
    const st = stIdx!==-1 ? teams[stIdx] : null;
    const refund = p.soldPrice ?? p.currentBid;
    const msg = p.status==="sold" && st
      ? `Delete ${p.name}?\n\nThis removes them from ${st.name} and refunds ${fmt(refund)}.`
      : `Delete ${p.name} from the auction?`;
    if (!window.confirm(msg)) return;
    const next = players.filter((_,i) => i!==cur);
    setPlayers(next);
    setBids([]);
    setGoing(0);
    if (p.manuallyAdded) {
      const nm = manualPlayers.filter(mp => playerKey(mp)!==playerKey(p));
      setManualPlayers(nm); wrManual(nm);
    }
    if (st) setTeams(prev => prev.map((t,i) => i!==stIdx ? t : { ...t, purse:t.purse+refund, players:t.players.filter(tp=>tp.serialNo!==p.serialNo) }));
    setOverlay(null);
    setCur(prev => Math.min(prev, Math.max(0, next.length-1)));
  }
  function addPlayer(player: Player) {
    setPlayers(prev => [...prev, player]);
    if (player.manuallyAdded) {
      const nm = mergePlayers(manualPlayers, [player]);
      setManualPlayers(nm); wrManual(nm);
    }
  }
  /** Put another player on the block — not allowed while bids are open on the current one. */
  function selectPlayer(idx: number) {
    if (idx !== cur && !canNav) { notify(`Bidding is open on ${p!.name} — mark SOLD (or retract the bids) first.`); return false; }
    setCur(idx); setOverlay(null); return true;
  }
  function jumpToSerial(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const n = parseInt(search.trim(), 10);
    if (isNaN(n)) return;
    const idx = players.findIndex(x => x.serialNo === n);
    if (idx === -1) { notify(`No player #${n} found.`); return; }
    if (selectPlayer(idx)) { setSearch(""); goTo("auction"); }
  }

  const filtered = filter === "all" ? players
    : filter === "uncertain" ? players.filter(x => x.availabilityUncertain)
    : players.filter(x => x.role === filter);

  const totalSpent = teams.reduce((a,t) => a + (rules.totalPurse - t.purse), 0);
  const highestBid = sold > 0 ? Math.max(...players.filter(p=>p.soldPrice).map(p=>p.soldPrice!)) : 0;

  // Advance the call on a timer; any change to `going` (bid, retract, cancel) restarts or stops it.
  useEffect(() => {
    sendDisplay({ type:"going", stage:going });
    if (going) play(going === 1 ? "once" : "twice");
    if (!going || !callSecs(rules)) return;   // manual mode: the auctioneer advances each stage
    const t = window.setTimeout(() => { if (going === 1) setGoing(2); else markSold(); }, callSecs(rules) * 1000);
    return () => window.clearTimeout(t);
  }, [going]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;   // leave browser shortcuts (Ctrl+R etc.) alone
      if (e.key === "?") { e.preventDefault(); setShowHelp(h => !h); return; }
      if (showHelp) { if (e.key === "Escape") { e.preventDefault(); setShowHelp(false); } return; }
      if (e.key === "m" || e.key === "M") { e.preventDefault(); toggleSound(); return; }
      if (view !== "auction") return;
      if (e.key === "ArrowRight") { e.preventDefault(); nextPlayer(); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); prevPlayer(); }
      if (/^[1-9]$/.test(e.key) && Number(e.key) <= teams.length) { e.preventDefault(); teamBid(Number(e.key) - 1); }
      if (e.key === "-" || e.key === "Backspace") { e.preventDefault(); retractBid(); }
      if (e.key === "g" || e.key === "G") { e.preventDefault(); callGoing(); }
      if (e.key === "r" || e.key === "R") { e.preventDefault(); randomPlayer(); }
      if (e.key === "Escape" && going) { e.preventDefault(); setGoing(0); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // ── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes popIn  { 0%{transform:scale(.5);opacity:0} 60%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
        @keyframes bidUp  { 0%{transform:translateY(-16px);opacity:0} 100%{transform:translateY(0);opacity:1} }
        @keyframes pulse  { 0%{box-shadow:0 0 0 0 rgba(255,59,48,.7)} 70%{box-shadow:0 0 0 8px rgba(255,59,48,0)} 100%{box-shadow:0 0 0 0 rgba(255,59,48,0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .pop  { animation: popIn .32s cubic-bezier(.34,1.56,.64,1) forwards; }
        .bidup{ animation: bidUp .22s ease forwards; }
        .puls { animation: pulse 1.4s infinite; }
        @keyframes callbar { from{width:100%} to{width:0%} }
        .callbar{ animation-name: callbar; animation-timing-function: linear; animation-fill-mode: forwards; }
        .cbtn { transition: opacity .15s, transform .1s; }
        .cbtn:hover:not(:disabled){ opacity:.82; }
        .cbtn:active:not(:disabled){ transform:scale(.96); }
        .cbtn:disabled{ opacity:.25!important; cursor:not-allowed!important; }
        .prow:hover{ background:#0c1830!important; }
        .fbtab{ transition:all .15s; }
        .fbtab:hover:not(.fb-on){ color:#c0d4f0!important; }
        *{ box-sizing:border-box; }
        ::-webkit-scrollbar{ width:4px; height:4px; }
        ::-webkit-scrollbar-track{ background:#06101e; }
        ::-webkit-scrollbar-thumb{ background:#1a2d50; border-radius:4px; }
      `}</style>

      <div style={{ background:"#030710", minHeight:"100vh", color:"#fff", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
        <div style={{ padding:"0 10px 10px", display:"flex", flexDirection:"column", minHeight:"100vh" }}>

          {/* ── HEADER ────────────────────────────────────────────────────────── */}
          <div style={{ background:"#07101e", borderBottom:"1px solid #1a2d50", padding:"12px 22px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
            {/* Brand */}
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              {config.league.logo ? (
                <img src={config.league.logo} alt="logo" style={{ height:44, width:44, objectFit:"contain", borderRadius:8 }} onError={e=>(e.currentTarget.style.display="none")} />
              ) : (
                <div style={{ width:44, height:44, background:"#f0c040", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:16, color:"#050a14", flexShrink:0 }}>
                  {config.league.name.split(" ").map(w=>w[0]).join("").slice(0,3).toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontSize:20, fontWeight:800, color:"#f0c040", lineHeight:1.2, letterSpacing:".3px" }}>{config.league.name}</div>
                <div style={{ fontSize:13, color:"#4a6080", letterSpacing:"1px", textTransform:"uppercase", marginTop:1 }}>Player Auction {config.league.year}</div>
              </div>
              {/* Live badge */}
              <div style={{ display:"flex", alignItems:"center", gap:7, background:"#1a0808", border:"1px solid #5a1010", borderRadius:20, padding:"4px 12px" }}>
                <div className="puls" style={{ width:9, height:9, borderRadius:"50%", background:"#ff3b30", flexShrink:0 }} />
                <span style={{ fontSize:13, fontWeight:800, color:"#ff5f57", letterSpacing:"1.5px" }}>LIVE</span>
              </div>
            </div>
            {/* Stats */}
            <div style={{ display:"flex", gap:20, alignItems:"center", flexWrap:"wrap" }}>
              {([
                { label:"Total",     val:players.length, color:"#8899bb" },
                { label:"Sold",      val:sold,           color:"#30d158" },
                { label:"Unsold",    val:unsold,         color:"#ff5f57" },
                { label:"Remaining", val:remaining,      color:"#f0c040" },
              ] as const).map(s => (
                <div key={s.label} style={{ textAlign:"center", minWidth:48 }}>
                  <div style={{ fontSize:26, fontWeight:900, color:s.color, lineHeight:1 }}>{s.val}</div>
                  <div style={{ fontSize:11, color:"#3d5070", textTransform:"uppercase", letterSpacing:".5px", marginTop:2 }}>{s.label}</div>
                </div>
              ))}
              <div style={{ display:"flex", gap:8, marginLeft:8 }}>
                {summaryOnProj && view !== "summary" && (
                  <button className="cbtn" onClick={()=>setProjSummary(false)} title="The projector is showing the summary — click to go back to the live auction"
                    style={{ padding:"8px 12px", border:"1px solid #5c4400", borderRadius:8, fontSize:13, cursor:"pointer", fontWeight:800, background:"#2b1f00", color:"#f0c040" }}>
                    📺 Summary on projector ✕
                  </button>
                )}
                {view !== "summary" && (
                  <button className="cbtn" onClick={()=>goTo("summary")} title="Auction summary: highlights and every squad"
                    style={{ padding:"8px 16px", border:"1px solid #1a2d50", borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:700, background:"#111f3a", color:"#90a4d4" }}>
                    🏆 Summary
                  </button>
                )}
                {view === "auction" ? (
                  <button className="cbtn" onClick={()=>goTo("players")}
                    style={{ padding:"8px 16px", border:"1px solid #1a2d50", borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:700, background:"#111f3a", color:"#90a4d4" }}>
                    👥 Players
                  </button>
                ) : (
                  <button className="cbtn" onClick={()=>goTo("auction")}
                    style={{ padding:"8px 16px", border:"1px solid #3a2800", borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:700, background:"#2b1f00", color:"#f0c040" }}>
                    ← Auction
                  </button>
                )}
                <button className="cbtn" onClick={()=>setShowRoster(true)}
                  style={{ padding:"8px 16px", border:"1px solid #1a2d50", borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:700, background:"#111f3a", color:"#90a4d4" }}>
                  📋 Rosters
                </button>
                <button className="cbtn" onClick={openDisplay} title="Open the audience screen in a new window — drag it to the projector"
                  style={{ padding:"8px 16px", border:"1px solid #3a2800", borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:700, background:"#2b1f00", color:"#f0c040" }}>
                  📺 Display
                </button>
                <button className="cbtn" onClick={toggleSound} title={sound ? "Sound on — click to mute (key M)" : "Sound off — click to turn on (key M)"}
                  style={{ padding:"8px 12px", border:"1px solid #1a2d50", borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:700, background:"#0a1528", color: sound ? "#90a4d4" : "#4a6080" }}>
                  {sound ? "🔊" : "🔇"}
                </button>
                <button className="cbtn" onClick={()=>setShowHelp(true)} title="Keyboard shortcuts (?)"
                  style={{ padding:"8px 12px", border:"1px solid #1a2d50", borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:700, background:"#0a1528", color:"#90a4d4" }}>
                  ⌨ ?
                </button>
                <button className="cbtn" onClick={openSetup}
                  style={{ padding:"8px 14px", border:"1px solid #1a2d50", borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:700, background:"#0a1528", color:"#6a80aa" }}>
                  ⚙ Setup
                </button>
                <button className="cbtn" onClick={resetAll}
                  style={{ padding:"8px 14px", border:"1px solid #3a1010", borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:700, background:"#1e0808", color:"#ff5f57" }}>
                  🔄
                </button>
                <button className="cbtn" onClick={backup} title="Download a backup file of the whole auction"
                  style={{ padding:"8px 14px", border:"1px solid #1a2d50", borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:700, background:"#0a1528", color:"#6a80aa" }}>
                  💾 Backup
                </button>
                <RestoreButton style={{ padding:"8px 14px", border:"1px solid #1a2d50", borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:700, background:"#0a1528", color:"#6a80aa" }} />
                <UserBadge user={user} />
              </div>
            </div>
          </div>

          {saveFailed && !saveWarnClosed && (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap", padding:"10px 22px", background:"#2a0a0a", borderBottom:"1px solid #5a1010", color:"#ff8a80", fontSize:14, fontWeight:700 }}>
              <span>⚠ Auto-save failed — browser storage is full. Progress will be lost on a crash or reload. Download a backup now.</span>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <button className="cbtn" onClick={backup}
                  style={{ padding:"6px 14px", border:"1px solid #ff5f57", borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:800, background:"#ff5f57", color:"#1a0505" }}>
                  💾 Download Backup
                </button>
                <button className="cbtn" onClick={() => setSaveWarnClosed(true)} title="Close" aria-label="Close warning"
                  style={{ padding:"6px 10px", border:"1px solid #5a1010", borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:800, background:"transparent", color:"#ff8a80" }}>
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* ── MAIN CONTENT ───────────────────────────────────────────────────── */}
          {view === "auction" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 380px", flex:1 }}>

            {/* LEFT: PLAYER CARD */}
            <div style={{ padding:22, borderRight:"1px solid #1a2d50", display:"flex", flexDirection:"column", gap:0 }}>
              <div style={{ fontSize:11, color:"#3d5070", textTransform:"uppercase", letterSpacing:"2px", fontWeight:700, marginBottom:14 }}>Now on Auction</div>

              {p ? (
                <div style={{ background:"#07101e", border:"1px solid #1a2d50", borderRadius:16, overflow:"hidden", position:"relative", flex:1, display:"flex", flexDirection:"column" }}>
                  {/* Photo area — grows to fill spare card height */}
                  <div style={{ flex:1, minHeight:360, position:"relative", overflow:"hidden", display:"flex" }}>
                    {/* Photo — left */}
                    <div style={{ flex:1, position:"relative", minWidth:0 }}>
                      <div style={{ position:"absolute", inset:0 }}>
                        <PhotoAvatar photo={p.photo} name={p.name} card />
                      </div>
                      {/* Serial badge — small, top-left corner only */}
                      <div style={{ position:"absolute", top:12, left:12, background:"rgba(7,16,30,.75)", backdropFilter:"blur(6px)", border:"1px solid #2a3d6a", borderRadius:8, padding:"4px 10px", fontSize:12, fontWeight:700, color:"#90a4d4", letterSpacing:"1.5px" }}>
                        #{p.serialNo}
                      </div>
                    </div>
                    {/* Player details + prices — right of photo */}
                    <div style={{ width:"clamp(240px, 40%, 360px)", flexShrink:0, borderLeft:"1px solid #1a2d50", background:"#060e1b",
                      display:"flex", flexDirection:"column", justifyContent:"center", gap:22, padding:"20px 22px", overflowY:"auto" }}>
                      <div>
                        <div style={{ fontSize:28, fontWeight:900, color:"#fff", lineHeight:1.1, letterSpacing:".3px", marginBottom:10, wordBreak:"break-word" }}>
                          {p.name}
                        </div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                          <span style={{ fontSize:13, padding:"3px 10px", borderRadius:20, fontWeight:700, ...(ROLE_STYLE[p.role]??{ background:"#1a2d50", color:"#90a4d4", border:"1px solid #2a3d6a" }) }}>{p.role}</span>
                          <span style={{ fontSize:13, padding:"3px 10px", borderRadius:20, fontWeight:700, background:"#1a2d50", color:"#8899bb", border:"1px solid #2a3d6a" }}>{p.batting}</span>
                          {p.bowling !== "N/A" && <span style={{ fontSize:13, padding:"3px 10px", borderRadius:20, fontWeight:700, background:"#1a2d50", color:"#8899bb", border:"1px solid #2a3d6a" }}>{p.bowling}</span>}
                          {p.availabilityUncertain && <span style={{ fontSize:13, padding:"3px 10px", borderRadius:20, fontWeight:700, ...UNCERTAIN_BADGE }}>May/May Not Play</span>}
                          {p.manuallyAdded && <span style={{ fontSize:13, padding:"3px 10px", borderRadius:20, fontWeight:700, ...MANUAL_BADGE }}>Manual Entry</span>}
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:12 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, color:"#6a80aa", fontSize:14 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="#4a6080" style={{ flexShrink:0 }}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                            {p.city}{p.state && p.state!=="—" ? `, ${p.state}` : ""}
                          </div>
                          {p.mobile && (
                            <div style={{ display:"flex", alignItems:"center", gap:6, color:"#6a80aa", fontSize:14 }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="#4a6080" style={{ flexShrink:0 }}><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
                              {p.mobile}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ height:1, background:"#111f3a" }} />
                      <div>
                        <div style={{ fontSize:12, color:"#3d5070", textTransform:"uppercase", letterSpacing:".8px", marginBottom:6 }}>Base price</div>
                        <div style={{ fontSize:26, fontWeight:700, color:"#6a80aa" }}>{fmt(p.basePrice)}</div>
                      </div>
                      <div style={{ height:1, background:"#111f3a" }} />
                      <div>
                        <div style={{ fontSize:12, color:"#3d5070", textTransform:"uppercase", letterSpacing:".8px", marginBottom:6 }}>Current Bid</div>
                        <div key={bidKey} className="bidup" style={{ fontSize:"clamp(34px, 3.6vw, 52px)", fontWeight:900, color:"#f0c040", lineHeight:1, letterSpacing:-1, textShadow:"0 0 30px rgba(240,192,64,.4)", wordBreak:"break-word" }}>
                          {fmt(p.currentBid)}
                        </div>
                        {avail && (leadTeam ? (
                          <div style={{ marginTop:10, display:"inline-flex", alignItems:"center", gap:8, padding:"5px 12px", borderRadius:20,
                            background:`${leadTeam.color}22`, border:`1px solid ${leadTeam.color}88`, color:leadTeam.color, fontSize:15, fontWeight:800 }}>
                            <span style={{ width:9, height:9, borderRadius:"50%", background:leadTeam.color }} />
                            {leadTeam.name}
                          </div>
                        ) : (
                          <div style={{ marginTop:10, fontSize:14, color:"#4a6080", fontWeight:600 }}>Awaiting opening bid</div>
                        ))}
                        {war && (
                          <div style={{ marginTop:10, padding:"6px 10px", borderRadius:10, background:"#2a0d05", border:"1px solid #7a3a10", fontSize:13, fontWeight:800, color:"#ff9f43", lineHeight:1.4 }}>
                            🔥 BID WAR · {war.count} bids<br />
                            <span style={{ color:teams[war.a]?.color }}>{teams[war.a]?.name}</span>
                            <span style={{ color:"#6a80aa" }}> vs </span>
                            <span style={{ color:teams[war.b]?.color }}>{teams[war.b]?.name}</span>
                            <span style={{ color:"#6a80aa", fontWeight:600 }}> · {fmt(war.from)} → {fmt(p!.currentBid)}</span>
                          </div>
                        )}
                        {avail && going > 0 && (
                          <div key={going} style={{ marginTop:10 }}>
                            <div style={{ fontSize:18, fontWeight:900, letterSpacing:"2px", color: going===1 ? "#f0a030" : "#ff5f57" }}>
                              {going===1 ? "GOING ONCE…" : "GOING TWICE…"}
                            </div>
                            {callSecs(rules) > 0 && (
                              <div style={{ height:4, background:"#111f3a", borderRadius:2, marginTop:6, overflow:"hidden" }}>
                                <div className="callbar" style={{ height:"100%", background: going===1 ? "#f0a030" : "#ff5f57", animationDuration:`${callSecs(rules)}s` }} />
                              </div>
                            )}
                          </div>
                        )}
                        {avail && bids.length > 1 && (
                          <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:4 }}>
                            <div style={{ fontSize:11, color:"#3d5070", textTransform:"uppercase", letterSpacing:".8px" }}>Bid history</div>
                            {bids.slice(0, -1).reverse().slice(0, 5).map((b, k) => (
                              <div key={k} style={{ display:"flex", justifyContent:"space-between", gap:10, fontSize:13, color:"#6a80aa" }}>
                                <span style={{ color:teams[b.team]?.color, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{teams[b.team]?.name}</span>
                                <span style={{ fontWeight:700 }}>{fmt(b.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* SOLD / UNSOLD overlay */}
                    {overlay && (
                      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:10,
                        background: overlay.text==="SOLD!" ? `${overlay.teamColor}33` : "rgba(255,59,48,.18)",
                        backdropFilter:"blur(4px)" }}>
                        <div className="pop" style={{ fontSize:64, fontWeight:900, letterSpacing:4, color: overlay.text==="SOLD!" ? (overlay.teamColor ?? "#30d158") : "#ff5f57", textShadow:`0 0 40px ${overlay.text==="SOLD!" ? (overlay.teamColor ?? "#30d158") : "#ff5f57"}` }}>
                          {overlay.text}
                        </div>
                        {overlay.price && <div style={{ fontSize:22, fontWeight:700, color:"#fff", textAlign:"center", padding:"0 20px", textShadow:"0 2px 8px rgba(0,0,0,.8)" }}>{overlay.price}</div>}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#3d5070", fontSize:18, background:"#07101e", border:"1px solid #1a2d50", borderRadius:16 }}>
                  No players loaded
                </div>
              )}
            </div>

            {/* RIGHT: TEAM SELECTION + CONTROLS */}
            <div style={{ display:"flex", flexDirection:"column", background:"#06101e" }}>
              {/* Team grid */}
              <div style={{ padding:"20px 18px 14px", borderBottom:"1px solid #1a2d50" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:14, gap:8 }}>
                  <div style={{ fontSize:11, color:"#3d5070", textTransform:"uppercase", letterSpacing:"2px", fontWeight:700 }}>Team Bids</div>
                  {p && avail && <div style={{ fontSize:12, color:"#6a80aa" }}>Next bid <b style={{ color:"#f0c040", fontSize:14 }}>{fmt(nextBid)}</b></div>}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                  {teams.map((t,i) => {
                    const leading = lead?.team === i;
                    const full = squadFull(t, rules);
                    const blocked = !!p && avail && !leading && (full || !canAfford(t, nextBid, rules.minPlayers, rules.defaultBasePrice));
                    const hot = leading;
                    return (
                      <button key={t.name} onClick={()=>teamBid(i)} disabled={!p || !avail}
                        title={full ? `${t.name} has the maximum ${rules.maxPlayers} players` : blocked ? `${t.name} cannot bid ${fmt(nextBid)} (max ${fmt(maxBid(t))})` : leading ? "Holds the current bid" : `Bid ${fmt(nextBid)} for ${t.name} (key ${i+1})`}
                        style={{ padding:"10px 6px", borderRadius:12, border:`2px solid ${hot?t.color:"#1a2d50"}`, position:"relative",
                          background: hot?`${t.color}22`:"transparent", cursor: !p || !avail ? "default" : "pointer", opacity: blocked ? .35 : 1,
                          display:"flex", flexDirection:"column", alignItems:"center", gap:5,
                          transition:"all .15s", boxShadow: hot?`0 0 18px ${t.color}55`:"none" }}>
                        {i < 9 && <span style={{ position:"absolute", top:5, left:7, fontSize:10, fontWeight:800, color:"#3d5070" }}>{i+1}</span>}
                        {leading && <span style={{ position:"absolute", top:4, right:5, fontSize:9, fontWeight:900, letterSpacing:".5px", color:"#050a14", background:t.color, borderRadius:6, padding:"1px 5px" }}>LEAD</span>}
                        <div style={{ width:40, height:40, borderRadius:"50%",
                          background:`linear-gradient(135deg, ${t.color}22, ${t.color}55)`,
                          border:`2px solid ${hot?t.color:t.color+"66"}`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:14, fontWeight:900, color:t.color, flexShrink:0 }}>
                          {t.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                        </div>
                        <span style={{ fontSize:12, fontWeight:700, color:hot?t.color:"#90a4d4", textAlign:"center", lineHeight:1.25, wordBreak:"break-word" }}>{t.name}</span>
                        <span style={{ fontSize:12, color:"#6a80aa", fontWeight:600 }}>{fmt(t.purse)}</span>
                        <span style={{ fontSize:11, color:blocked?"#ff5f57":"#4a6080", fontWeight:600 }}>{full ? "SQUAD FULL" : `max ${fmt(maxBid(t))}`}</span>
                        <span style={{ fontSize:11, color:t.players.length>=rules.minPlayers?"#30d158":"#3d5070", fontWeight:700 }}
                          title={`min ${rules.minPlayers}${rules.maxPlayers ? `, max ${rules.maxPlayers}` : ""}`}>
                          {t.players.length}/{rules.minPlayers}{rules.maxPlayers ? ` · ≤${rules.maxPlayers}` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ padding:"16px 18px", display:"flex", flexDirection:"column", gap:10 }}>
                <button className="cbtn" onClick={retractBid} disabled={!canLow} title="Take back the last bid (key − or Backspace)"
                  style={{ padding:"12px 0", borderRadius:10, border:"1px solid #1a2d50", fontSize:15, fontWeight:800, cursor:"pointer", background:"#0c1830", color:"#90a4d4" }}>
                  ↶ Retract last bid
                </button>
                <div style={{ display:"grid", gridTemplateColumns: going ? "1fr auto" : "1fr", gap:8 }}>
                  <button className="cbtn" onClick={callGoing} disabled={!avail || !leadTeam} title={callSecs(rules) ? "Auctioneer's call — auto-SOLD at the end (key G, Esc cancels)" : "Auctioneer's call — press for once, twice, SOLD (key G, Esc cancels)"}
                    style={{ padding:"12px 0", borderRadius:10, border:`1px solid ${going?"#7a3a10":"#3a2800"}`, fontSize:15, fontWeight:800, cursor:"pointer",
                      background: going ? "#2a1205" : "#1a1000", color: going===2 ? "#ff7a50" : "#f0a030" }}>
                    {going===0 ? "🔨 Going once…" : going===1 ? "🔨 Going twice ▸" : callSecs(rules) ? "🔨 Sold now ▸" : "🔨 SOLD ▸"}
                  </button>
                  {going > 0 && (
                    <button className="cbtn" onClick={()=>setGoing(0)} title="Cancel the call (Esc)"
                      style={{ padding:"12px 14px", borderRadius:10, border:"1px solid #1a2d50", fontSize:15, fontWeight:800, cursor:"pointer", background:"#0c1830", color:"#90a4d4" }}>
                      ✕
                    </button>
                  )}
                </div>
                <button className="cbtn" onClick={markSold} disabled={!avail || !leadTeam}
                  style={{ padding:"16px 0", borderRadius:10, border:"1px solid #1a4a2a", fontSize:20, fontWeight:900, cursor:"pointer", background:"#0a2818", color:"#30d158", letterSpacing:"2px" }}>
                  ✓ SOLD{leadTeam ? <span style={{ display:"block", fontSize:13, letterSpacing:0, fontWeight:700, marginTop:3, color:"#8fdca6" }}>to {leadTeam.name} · {fmt(p!.currentBid)}</span> : null}
                </button>
                <button className="cbtn" onClick={markUnsold} disabled={!canUns}
                  style={{ padding:"13px 0", borderRadius:10, border:"1px solid #3a1010", fontSize:16, fontWeight:800, cursor:"pointer", background:"#180808", color:"#ff5f57" }}>
                  ✗ UNSOLD
                </button>
                {lastSnapshot && (
                  <button className="cbtn" onClick={undoLast}
                    style={{ padding:"13px 0", borderRadius:10, border:"1px solid #3a2800", fontSize:16, fontWeight:800, cursor:"pointer", background:"#1a1000", color:"#f0a030" }}>
                    ↩ Undo Last
                  </button>
                )}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <button className="cbtn" onClick={prevPlayer} disabled={!canNav}
                    style={{ padding:"12px 0", borderRadius:10, border:"1px solid #1a2d50", fontSize:15, fontWeight:800, cursor:"pointer", background:"#0a1528", color:"#6a80aa" }}>
                    ◀ PREV
                  </button>
                  <button className="cbtn" onClick={nextPlayer} disabled={!canNav}
                    style={{ padding:"12px 0", borderRadius:10, border:"none", fontSize:15, fontWeight:800, cursor:"pointer", background:"#f0c040", color:"#050a14" }}>
                    NEXT ▶
                  </button>
                </div>
                <button className="cbtn" onClick={randomPlayer} disabled={!canNav} title="Draw a random available player (key R)"
                  style={{ padding:"11px 0", borderRadius:10, border:"1px solid #2a3d6a", fontSize:15, fontWeight:800, cursor:"pointer", background:"#0c1830", color:"#c0d4f0" }}>
                  🎲 Random player
                </button>
                <button className="cbtn" onClick={deletePlayer} disabled={!p}
                  style={{ padding:"10px 0", borderRadius:10, border:"1px solid #2a1010", fontSize:14, fontWeight:700, cursor:"pointer", background:"transparent", color:"#7a4040" }}>
                  Delete Player
                </button>
              </div>

              {/* Auction summary */}
              <div style={{ marginTop:"auto", borderTop:"1px solid #1a2d50", padding:"14px 18px", background:"#07101e" }}>
                <div style={{ fontSize:11, color:"#3d5070", textTransform:"uppercase", letterSpacing:"1.5px", fontWeight:700, marginBottom:12 }}>Summary</div>
                {[
                  { label:"Total spent",      val:fmt(totalSpent),             color:"#f0c040" },
                  { label:"Players sold",     val:String(sold),                color:"#30d158" },
                  { label:"Highest bid",      val:highestBid>0?fmt(highestBid):"—", color:"#f0c040" },
                  { label:`Teams at ${rules.minPlayers}+`, val:`${teams.filter(t=>t.players.length>=rules.minPlayers).length}/${teams.length}`, color:"#90a4d4" },
                ].map(s => (
                  <div key={s.label} style={{ display:"flex", justifyContent:"space-between", fontSize:14, marginBottom:7 }}>
                    <span style={{ color:"#4a6080" }}>{s.label}</span>
                    <span style={{ color:s.color, fontWeight:800 }}>{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          )}

          {/* ── SUMMARY PAGE ───────────────────────────────────────────────────── */}
          {view === "summary" && (
          <div style={{ borderTop:"1px solid #1a2d50", display:"flex", flexDirection:"column", flex:1 }}>
            <div style={{ padding:"12px 18px", borderBottom:"1px solid #111f3a", background:"#06101e", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              <span style={{ fontSize:13, color:"#4a6080", fontWeight:700, flex:1 }}>
                {remaining > 0 ? `${remaining} players still to go — the summary updates as you sell.` : "Auction complete."}
              </span>
              <button className="cbtn" onClick={downloadSummary}
                style={{ padding:"8px 14px", border:"1px solid #3a2800", borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:700, background:"#2b1f00", color:"#f0c040" }}>
                📸 Download image
              </button>
              <button className="cbtn" onClick={()=>setProjSummary(!summaryOnProj)}
                title={summaryOnProj ? "Put the live auction back on the projector" : "Show this summary on the 📺 projector window"}
                style={{ padding:"8px 14px", border:`1px solid ${summaryOnProj ? "#1a4a2a" : "#1a2d50"}`, borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:700,
                  background: summaryOnProj ? "#0a2818" : "#111f3a", color: summaryOnProj ? "#30d158" : "#90a4d4" }}>
                {summaryOnProj ? "📺 On projector — hide" : "📺 Show on projector"}
              </button>
            </div>
            <AuctionSummary config={config} players={players} teams={teams} innerRef={summaryRef} />
          </div>
          )}

          {/* ── PLAYERS PAGE ───────────────────────────────────────────────────── */}
          {view === "players" && (
          <div style={{ borderTop:"1px solid #1a2d50", background:"#06101e", display:"flex", flexDirection:"column", flex:1 }}>
            {/* Controls row */}
            <div style={{ padding:"12px 18px", borderBottom:"1px solid #111f3a", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
              <span style={{ fontSize:13, color:"#4a6080", fontWeight:700, whiteSpace:"nowrap" }}>
                Players <span style={{ color:"#f0c040", fontSize:16, fontWeight:900 }}>{players.length}</span>
              </span>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap", flex:1 }}>
                {[
                  { key:"all",           label:"All" },
                  { key:"Batsman",       label:"Batsman" },
                  { key:"Bowler",        label:"Bowler" },
                  { key:"All-Rounder",   label:"All-Rounder" },
                  { key:"Wicket Keeper", label:"WK" },
                  { key:"uncertain",     label:"May/May Not" },
                ].map(f => (
                  <button key={f.key} className={`fbtab ${filter===f.key?"fb-on":""}`} onClick={()=>setFilter(f.key)}
                    style={{ fontSize:12, padding:"4px 10px", borderRadius:20, border:"1px solid",
                      borderColor: filter===f.key?"#2a3d6a":"#111f3a",
                      background: filter===f.key?"#1a2d50":"transparent",
                      color: filter===f.key?"#90a4d4":"#4a6080",
                      cursor:"pointer", fontWeight:600, transition:"all .15s" }}>
                    {f.label}
                  </button>
                ))}
              </div>
              <input type="number" min={1} placeholder="Jump to # →Enter" value={search}
                onChange={e=>setSearch(e.target.value)} onKeyDown={jumpToSerial}
                style={{ width:160, background:"#0a1428", border:"1px solid #1a2d50", borderRadius:7, padding:"6px 10px", fontSize:13, color:"#fff", outline:"none" }} />
              <button className="cbtn" onClick={()=>setShowAddPlayer(true)}
                style={{ padding:"6px 14px", border:"1px solid #1a4a2a", borderRadius:7, fontSize:13, cursor:"pointer", fontWeight:700, background:"#0a2818", color:"#30d158", whiteSpace:"nowrap" }}>
                + Add
              </button>
            </div>

            {/* Recent Activity bar */}
            {activity.length > 0 && (
              <div style={{ padding:"10px 18px", borderBottom:"1px solid #111f3a", background:"#030a14", display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ flexShrink:0, display:"flex", flexDirection:"column", gap:3 }}>
                  <span style={{ fontSize:10, color:"#4a6080", fontWeight:700, textTransform:"uppercase", letterSpacing:"1.5px" }}>Recent Activity</span>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div className="puls" style={{ width:7, height:7, borderRadius:"50%", background:"#30d158", flexShrink:0 }} />
                    <span style={{ fontSize:11, fontWeight:800, color:"#30d158", letterSpacing:"1px" }}>LIVE</span>
                  </div>
                </div>
                <div style={{ width:1, height:38, background:"#1a2d50", flexShrink:0 }} />
                <div style={{ display:"flex", gap:10, overflowX:"auto", flex:1, paddingBottom:2 }}>
                  {activity.map((a,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:8, background:"#0a1528", border:`1px solid ${a.teamColor}33`, borderRadius:10, padding:"7px 12px", flexShrink:0 }}>
                      <div style={{ width:32, height:32, borderRadius:"50%", background:`${a.teamColor}22`, border:`2px solid ${a.teamColor}66`,
                        display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:900, color:a.teamColor, flexShrink:0 }}>
                        {a.teamName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:a.teamColor, whiteSpace:"nowrap" }}>{a.teamName}</div>
                        <div style={{ fontSize:13, fontWeight:900, color:"#f0c040" }}>{fmt(a.price)}</div>
                        <div style={{ fontSize:11, color:"#3d5070" }}>{timeAgo(a.soldAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scrollable player rows */}
            <div>
              {filtered.length === 0 && (
                <div style={{ padding:40, textAlign:"center", color:"#4a6080", fontSize:16 }}>No players match this filter.</div>
              )}
              {filtered.map(pl => {
                const ri = players.indexOf(pl);
                const isCur = ri === cur;
                const stColor = isCur?"#f0c040":pl.status==="sold"?"#30d158":pl.status==="unsold"?"#ff5f57":"#4a6080";
                const stBg    = isCur?"#2b1f00":pl.status==="sold"?"#0a2818":pl.status==="unsold"?"#180808":"#111f3a";
                const stLabel = isCur?"On Auction":pl.status==="sold"?"Sold":pl.status==="unsold"?"Unsold":"Available";
                const tc = pl.soldTo ? teams.find(t=>t.name===pl.soldTo)?.color : undefined;
                return (
                  <div key={ri} className="prow" onClick={()=>{ if (selectPlayer(ri)) goTo("auction"); }}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 18px", borderBottom:"1px solid #0a1528", cursor:"pointer",
                      borderLeft:`3px solid ${isCur?"#f0c040":"transparent"}`, background:"transparent", transition:"background .12s" }}>
                    <PhotoAvatar photo={pl.photo} name={pl.name} size={36} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, color:"#fff", fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        <span style={{ color:"#3d5070", marginRight:5 }}>#{pl.serialNo}</span>{pl.name}
                      </div>
                      <div style={{ fontSize:12, color:"#4a6080", marginTop:2, display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
                        {pl.role}
                        {pl.soldTo && <span style={{ color:tc, fontWeight:700 }}>→ {pl.soldTo}</span>}
                        {pl.availabilityUncertain && <span style={{ ...UNCERTAIN_BADGE, fontSize:11, padding:"1px 6px", borderRadius:20 }}>May/May Not</span>}
                        {pl.manuallyAdded && <span style={{ ...MANUAL_BADGE, fontSize:11, padding:"1px 6px", borderRadius:20 }}>Manual</span>}
                      </div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:2 }}>
                      <div style={{ fontSize:12, padding:"2px 8px", borderRadius:20, fontWeight:700, color:stColor, background:stBg }}>{stLabel}</div>
                      {pl.soldPrice && <div style={{ fontSize:13, color:"#f0c040", fontWeight:800 }}>{fmt(pl.soldPrice)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}

        </div>
      </div>

      {toast && (
        <div role="status" style={{ position:"fixed", left:"50%", bottom:24, transform:"translateX(-50%)", zIndex:50, maxWidth:"min(560px, calc(100vw - 32px))",
          background:"#1a1000", border:"1px solid #5c4400", color:"#f0c040", padding:"12px 18px", borderRadius:10, fontSize:15, fontWeight:700,
          boxShadow:"0 8px 30px rgba(0,0,0,.6)", textAlign:"center" }} onClick={()=>setToast(null)}>
          {toast}
        </div>
      )}
      {showHelp && <ShortcutHelp onClose={()=>setShowHelp(false)} />}
      {showRoster   && <TeamRoster teams={teams} config={config} onClose={()=>setShowRoster(false)} />}
      {showAddPlayer && (
        <AddPlayerModal
          nextSerial={players.length > 0 ? Math.max(...players.map(p=>p.serialNo))+1 : 1}
          config={config}
          onAdd={addPlayer}
          onClose={()=>setShowAddPlayer(false)}
        />
      )}
    </>
  );
}
