import React, { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import Login from "./Login";
import { currentUser, logout } from "./auth";

/* ═══════════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════════ */

type Status = "available" | "sold" | "unsold";

interface Player {
  serialNo: number; name: string; role: string; batting: string; bowling: string;
  city: string; state: string; mobile: string; basePrice: number; currentBid: number;
  photo: string; availabilityUncertain: boolean; manuallyAdded: boolean;
  status: Status; soldTo?: string; soldPrice?: number;
}
interface Team { name: string; color: string; purse: number; players: Player[]; }
interface LeagueConfig { name: string; year: string; logo: string; }
interface RulesConfig { totalPurse: number; minPlayers: number; bidStep: number; defaultBasePrice: number; }
interface TeamDef { name: string; color: string; }
interface ColumnMap {
  name: string; photo: string; skills: string; address: string;
  mobile: string; availability: string; basePrice: string;
}
interface AuctionConfig {
  league: LeagueConfig; rules: RulesConfig; teams: TeamDef[];
  csv: { url: string; columnMap: Partial<ColumnMap>; };
}
interface AuctionState { players: Player[]; teams: Team[]; cur: number; selTeam: number; }

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════════ */

const CONFIG_KEY = "auction-config-v2";
const STATE_KEY  = "auction-state-v2";
const MANUAL_KEY = "auction-manual-v2";

const DEFAULT_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ53BEPKar2-EpozZWB4Oxr13lImHg6QwpOma8HDtuJ5Uu03kqWuCn_xCjgwbVjnhRUlytjmGRTGVff/pub?gid=1862176652&single=true&output=csv";

const DEFAULT_TEAMS: TeamDef[] = [
  { name: "Ajoba Warrior's",    color: "#e53935" },
  { name: "Parthvik Jaguar's",  color: "#fb8c00" },
  { name: "Shrisha Striker's",  color: "#43a047" },
  { name: "Shrisha Warrior's",  color: "#1e88e5" },
  { name: "Mandev Cricketer's", color: "#8e24aa" },
  { name: "MSC Warrior's",      color: "#00acc1" },
];

const DEFAULT_CONFIG: AuctionConfig = {
  league: { name: "Shigao Premier League", year: "2026", logo: "" },
  rules:  { totalPurse: 10000, minPlayers: 12, bidStep: 100, defaultBasePrice: 300 },
  teams:  DEFAULT_TEAMS,
  csv:    { url: DEFAULT_CSV, columnMap: {} },
};

const PRESET_COLORS = [
  "#e53935","#fb8c00","#fdd835","#43a047",
  "#00acc1","#1e88e5","#3949ab","#8e24aa",
  "#f06292","#ff7043","#26a69a","#78909c",
];

const COL_CONCEPTS: { key: keyof ColumnMap; label: string; required: boolean }[] = [
  { key: "name",         label: "Player Name",  required: true  },
  { key: "photo",        label: "Photo URL",     required: false },
  { key: "skills",       label: "Skills / Role", required: false },
  { key: "address",      label: "City, State",   required: false },
  { key: "mobile",       label: "Mobile",        required: false },
  { key: "availability", label: "Availability",  required: false },
  { key: "basePrice",    label: "Base Price",    required: false },
];

const ROLE_STYLE: Record<string, React.CSSProperties> = {
  Batsman:         { background: "#0d2b0d", color: "#4caf50", border: "1px solid #1a5c1a" },
  Bowler:          { background: "#0d1a3a", color: "#7986cb", border: "1px solid #1a2d6b" },
  "All-Rounder":   { background: "#2b1f00", color: "#f0c040", border: "1px solid #5c4400" },
  "Wicket Keeper": { background: "#2b1000", color: "#ff9800", border: "1px solid #5c3000" },
};
const UNCERTAIN_BADGE: React.CSSProperties = { background: "#2b240d", color: "#f3cc6b", border: "1px solid #7a5d1f" };
const MANUAL_BADGE: React.CSSProperties    = { background: "#102b28", color: "#78d6c8", border: "1px solid #1f6a61" };

/* ═══════════════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════════════ */

const fmt = (n: number) => "₹" + Number(n).toLocaleString("en-IN");
const getInitials = (name: string) => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

function driveId(url: string) {
  for (const p of [/\/file\/d\/([a-zA-Z0-9_-]{10,})/, /[?&]id=([a-zA-Z0-9_-]{10,})/, /\/open\?id=([a-zA-Z0-9_-]{10,})/]) {
    const m = url.match(p); if (m) return m[1];
  }
  return "";
}
function driveUrls(raw: string): string[] {
  if (!raw?.trim()) return [];
  const id = driveId(raw);
  if (id) return [
    `https://drive.google.com/thumbnail?id=${id}&sz=w400`,
    `https://drive.google.com/uc?export=view&id=${id}`,
    `https://lh3.googleusercontent.com/d/${id}=w400`,
  ];
  return [raw];
}
function parseRow(row: string): string[] {
  const r: string[] = []; let cur = "", q = false;
  for (const ch of row) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) { r.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  r.push(cur.trim()); return r;
}
function isUncertain(raw: string) {
  const v = raw.trim().toLowerCase();
  return v ? ["yes","y","true","1","maybe","uncertain","tentative","may or may not","not sure"].some(f => v.includes(f)) : false;
}
function normPlayer(p: Partial<Player>, serial: number, minBase = 300): Player {
  const bp = Math.max(minBase, Number(p.basePrice) || minBase);
  return {
    serialNo: Number(p.serialNo) || serial, name: p.name?.trim() || "Unknown",
    role: p.role || "Batsman", batting: p.batting || "Right Hand", bowling: p.bowling || "N/A",
    city: p.city?.trim() || "—", state: p.state?.trim() || "—", mobile: p.mobile?.trim() || "",
    basePrice: bp, currentBid: Math.max(bp, Number(p.currentBid) || bp),
    photo: p.photo?.trim() || "", availabilityUncertain: Boolean(p.availabilityUncertain),
    manuallyAdded: Boolean(p.manuallyAdded),
    status: (p.status === "sold" || p.status === "unsold") ? p.status : "available",
    soldTo: p.soldTo, soldPrice: p.soldPrice,
  };
}
function playerKey(p: Pick<Player,"name"|"mobile"|"role"|"city"|"state"|"photo"|"basePrice">) {
  return [p.name,p.mobile,p.role,p.city,p.state,p.photo,String(p.basePrice)].map(v=>v.trim().toLowerCase()).join("|");
}
function mergePlayers(a: Player[], b: Player[]) {
  const seen = new Set<string>();
  return [...a,...b].filter(p => { const id=playerKey(p); if(seen.has(id)) return false; seen.add(id); return true; });
}
interface ActivityEntry { playerName: string; teamName: string; teamColor: string; price: number; soldAt: number; }
function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  return `${m} min ago`;
}
function canAfford(t: Team, bid: number, min: number, base: number) {
  return t.purse - bid >= Math.max(0, min - t.players.length - 1) * base;
}
function calcMax(t: Team, min: number, base: number) {
  return t.purse - Math.max(0, min - t.players.length - 1) * base;
}
function autoMap(headers: string[]): Partial<ColumnMap> {
  const h = headers.map(x => x.toLowerCase().trim());
  const f = (...kws: string[]) => { for (const kw of kws) { const i=h.findIndex(x=>x.includes(kw)); if(i>=0) return headers[i]; } return ""; };
  return {
    name:         f("player name","name"),
    photo:        f("player photo","photo","image","picture","img"),
    skills:       f("skills","skill","role"),
    address:      f("address","city","location","place"),
    mobile:       f("mobile number","mobile no","mobile","phone number","phone no","phone","contact number","contact no","contact","whatsapp"),
    availability: f("availability","participation","playing status","may or may not","available"),
    basePrice:    f("base price","base amount","price","amount"),
  };
}
async function fetchHeaders(url: string): Promise<string[]> {
  const r = await fetch(url); const t = await r.text();
  return parseRow(t.trim().split("\n")[0]);
}
function headersFromText(text: string): string[] {
  return parseRow(text.trim().split("\n")[0]);
}
function parseCSVText(text: string, map: Partial<ColumnMap>, minBase: number): Player[] {
  const rows = text.trim().split("\n").map(parseRow);
  const hdrs = rows[0].map(h => h.toLowerCase().trim());
  const ci = (col?: string) => {
    if (!col) return -1;
    const cl = col.toLowerCase().trim();
    const e = hdrs.indexOf(cl); if (e >= 0) return e;
    return hdrs.findIndex(h => h.includes(cl));
  };
  const get = (row: string[], key: keyof ColumnMap) => { const i=ci(map[key]); return i>=0?(row[i]||"").trim():""; };
  return rows.slice(1).filter(r => r.length > 1 && r[0]).map((row, i) => {
    const sk = get(row,"skills").toLowerCase().replace(/\s+/g,"");
    const addr = get(row,"address").split(",").map((a:string)=>a.trim());
    let role = "Batsman";
    if      (sk.includes("allrounder"))                      role = "All-Rounder";
    else if (sk.includes("wicket")||sk.includes("keeper"))   role = "Wicket Keeper";
    else if (sk.includes("bowler"))                          role = "Bowler";
    let batting = "Right Hand";
    if (sk.includes("lefthand")||sk.includes("left hand")||sk.includes("lhb")) batting = "Left Hand";
    let bowling = "N/A";
    if      (sk.includes("leftarmfast"))  bowling = "Left Arm Fast";
    else if (sk.includes("rightarmfast")) bowling = "Right Arm Fast";
    else if (sk.includes("leftarmspin"))  bowling = "Left Arm Spin";
    else if (sk.includes("rightarmspin")) bowling = "Right Arm Spin";
    else if (sk.includes("leftarm"))      bowling = "Left Arm Fast";
    else if (sk.includes("rightarm"))     bowling = "Right Arm Fast";
    const bpRaw = get(row,"basePrice");
    const bp = bpRaw ? Math.max(minBase, parseInt(bpRaw,10)||minBase) : minBase;
    return normPlayer({
      serialNo: i+1, name: get(row,"name")||"Unknown", photo: get(row,"photo"),
      role, batting, bowling, city: addr[0]||"—", state: addr[1]||"—",
      mobile: get(row,"mobile"), basePrice: bp, currentBid: bp,
      availabilityUncertain: isUncertain(get(row,"availability")),
      manuallyAdded: false, status: "available",
    }, i+1, minBase);
  });
}
async function fetchPlayers(url: string, map: Partial<ColumnMap>, minBase: number): Promise<Player[]> {
  const r = await fetch(url); const t = await r.text();
  return parseCSVText(t, map, minBase);
}

/* ═══════════════════════════════════════════════════════════════════
   STORAGE
═══════════════════════════════════════════════════════════════════ */

const rdCfg = (): AuctionConfig|null => { try { const s=localStorage.getItem(CONFIG_KEY); return s?JSON.parse(s):null; } catch{return null;} };
const wrCfg = (c: AuctionConfig) => { try { localStorage.setItem(CONFIG_KEY,JSON.stringify(c)); } catch{} };

function rdState(cfg: AuctionConfig, manual: Player[]): AuctionState|null {
  try {
    const s = localStorage.getItem(STATE_KEY); if (!s) return null;
    const st = JSON.parse(s) as Partial<AuctionState>; if (!st.players?.length) return null;
    const mb = cfg.rules.defaultBasePrice;
    return {
      players: mergePlayers(st.players.map((p,i)=>normPlayer(p,i+1,mb)), manual),
      teams: st.teams?.length
        ? st.teams.map(t=>({...t,purse:t.purse??cfg.rules.totalPurse,players:(t.players??[]).map((p,i)=>normPlayer(p,i+1,mb))}))
        : cfg.teams.map(t=>({...t,purse:cfg.rules.totalPurse,players:[]})),
      cur: st.cur??0, selTeam: st.selTeam??0,
    };
  } catch { return null; }
}
const wrState = (s: AuctionState) => { try { if(s.players.length) localStorage.setItem(STATE_KEY,JSON.stringify(s)); else localStorage.removeItem(STATE_KEY); } catch{} };
const clrState = () => { try { localStorage.removeItem(STATE_KEY); } catch{} };
function rdManual(mb: number): Player[] {
  try { const s=localStorage.getItem(MANUAL_KEY); return s?(JSON.parse(s) as Partial<Player>[]).map((p,i)=>normPlayer({...p,manuallyAdded:true},i+1,mb)):[];} catch{return[];}
}
const wrManual = (ps: Player[]) => { try { if(ps.length) localStorage.setItem(MANUAL_KEY,JSON.stringify(ps)); else localStorage.removeItem(MANUAL_KEY); } catch{} };

/* ═══════════════════════════════════════════════════════════════════
   PHOTO AVATAR
═══════════════════════════════════════════════════════════════════ */

function PhotoAvatar({ photo, name, card, size }: { photo:string; name:string; card?:boolean; size?:number }) {
  const urls = driveUrls(photo);
  const [idx, setIdx] = useState(0);
  const sz = size ?? (card ? undefined : 44);
  const ini = getInitials(name);
  const wrap: React.CSSProperties = card
    ? { width:"100%", height:"100%", background:"#06101e", overflow:"hidden", position:"relative" }
    : { width:sz, height:sz, borderRadius:"50%", background:"#06101e", overflow:"hidden", flexShrink:0, position:"relative" };
  const imgS: React.CSSProperties = card
    ? { width:"100%", height:"100%", objectFit:"contain", objectPosition:"center" }
    : { width:"100%", height:"100%", objectFit:"cover", objectPosition:"top" };
  const iniS: React.CSSProperties = {
    position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
    fontSize: card ? 72 : sz!>36?18:13, fontWeight:800, color:"#f0c040",
  };
  if (!urls.length || idx >= urls.length) return <div style={wrap}><span style={iniS}>{ini}</span></div>;
  return (
    <div style={wrap}>
      <img key={urls[idx]} src={urls[idx]} style={imgS} alt={name} referrerPolicy="no-referrer" onError={()=>setIdx(i=>i+1)} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SETUP WIZARD
═══════════════════════════════════════════════════════════════════ */

function UserBadge({ user }: { user: string|null }) {
  if (!user) return null;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <span style={{ fontSize:13, color:"#6a80aa", whiteSpace:"nowrap" }}>👤 {user}</span>
      <button className="cbtn" onClick={() => { logout(); location.reload(); }} title="Logout"
        style={{ padding:"8px 14px", border:"1px solid #1a2d50", borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:700, background:"#0a1528", color:"#6a80aa" }}>
        Logout
      </button>
    </div>
  );
}

const WIZ_STEPS = ["League","Teams","Rules","Players","Launch"];

function StepBar({ step }: { step: number }) {
  return (
    <div style={{ display:"flex", alignItems:"center", marginBottom:32 }}>
      {WIZ_STEPS.map((label, i) => (
        <React.Fragment key={label}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
            <div style={{
              width:34, height:34, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
              fontWeight:800, fontSize:14,
              background: step > i+1 ? "#30d158" : step === i+1 ? "#f0c040" : "#111f3a",
              color: step > i+1 || step === i+1 ? "#050a14" : "#4a6080",
              border: `2px solid ${step > i+1 ? "#30d158" : step === i+1 ? "#f0c040" : "#1a2d50"}`,
              transition:"all .2s",
            }}>
              {step > i+1 ? "✓" : i+1}
            </div>
            <span style={{ fontSize:12, color: step===i+1?"#f0c040":step>i+1?"#30d158":"#4a6080", fontWeight:600, letterSpacing:".5px", textTransform:"uppercase" }}>{label}</span>
          </div>
          {i < WIZ_STEPS.length-1 && (
            <div style={{ flex:1, height:2, background: step>i+1?"#30d158":"#1a2d50", margin:"0 6px", marginBottom:24, transition:"background .3s" }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

const wizInp: React.CSSProperties = { width:"100%", background:"#0a1428", border:"1px solid #1a2d50", borderRadius:8, padding:"10px 14px", fontSize:16, color:"#fff", outline:"none" };
const wizLbl: React.CSSProperties = { fontSize:13, color:"#6a80aa", marginBottom:6, display:"block", textTransform:"uppercase", letterSpacing:".6px", fontWeight:600 };

/* Step 1: League */
function Step1League({ cfg, onChange }: { cfg: AuctionConfig; onChange:(c:AuctionConfig)=>void }) {
  const [tab, setTab] = useState<"upload"|"url">(cfg.league.logo?"url":"upload");
  const upd = (key: keyof LeagueConfig, val: string) => onChange({ ...cfg, league: { ...cfg.league, [key]: val } });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div>
        <label style={wizLbl}>League Name</label>
        <input style={wizInp} value={cfg.league.name} placeholder="e.g. Shigao Premier League" onChange={e=>upd("name",e.target.value)} />
      </div>
      <div>
        <label style={wizLbl}>Year</label>
        <input style={{ ...wizInp, width:160 }} value={cfg.league.year} placeholder="2026" onChange={e=>upd("year",e.target.value)} />
      </div>
      <div>
        <label style={wizLbl}>Logo (optional)</label>
        <div style={{ display:"flex", marginBottom:10, border:"1px solid #1a2d50", borderRadius:8, overflow:"hidden" }}>
          {(["upload","url"] as const).map(t => (
            <button key={t} onClick={()=>{ setTab(t); upd("logo",""); }}
              style={{ flex:1, padding:"8px 0", border:"none", cursor:"pointer", fontSize:14, fontWeight:700,
                background: tab===t?"#1a2d50":"transparent", color: tab===t?"#90a4d4":"#4a6080" }}>
              {t==="upload" ? "📁 Upload" : "🔗 URL"}
            </button>
          ))}
        </div>
        {tab==="upload" ? (
          <label style={{ display:"block", cursor:"pointer" }}>
            <div style={{ border:"2px dashed #1a2d50", borderRadius:8, padding:"20px 14px", textAlign:"center", color:"#4a6080", fontSize:15, background:"#07101e" }}>
              {cfg.league.logo
                ? <img src={cfg.league.logo} alt="logo" style={{ maxHeight:80, maxWidth:"100%", objectFit:"contain", borderRadius:6 }} />
                : "Click to choose or drag & drop an image"}
            </div>
            <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{
              const f = e.target.files?.[0]; if(!f) return;
              const rd = new FileReader(); rd.onload=ev=>upd("logo",ev.target?.result as string); rd.readAsDataURL(f);
            }} />
          </label>
        ) : (
          <input style={wizInp} value={cfg.league.logo} placeholder="https://..." onChange={e=>upd("logo",e.target.value)} />
        )}
      </div>
    </div>
  );
}

/* Step 2: Teams */
function Step2Teams({ cfg, onChange }: { cfg: AuctionConfig; onChange:(c:AuctionConfig)=>void }) {
  const [editIdx, setEditIdx] = useState<number|null>(null);
  const [showPicker, setShowPicker] = useState<number|null>(null);

  const addTeam = () => {
    const next = [...cfg.teams, { name: "New Team", color: PRESET_COLORS[cfg.teams.length % PRESET_COLORS.length] }];
    onChange({ ...cfg, teams: next });
    setEditIdx(next.length - 1);
  };
  const delTeam = (i: number) => {
    if (cfg.teams.length <= 2) { alert("Need at least 2 teams."); return; }
    const t = [...cfg.teams]; t.splice(i,1);
    onChange({ ...cfg, teams: t });
  };
  const updTeam = (i: number, key: keyof TeamDef, val: string) => {
    const t = [...cfg.teams]; t[i] = { ...t[i], [key]: val };
    onChange({ ...cfg, teams: t });
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ fontSize:13, color:"#4a6080", marginBottom:4, textTransform:"uppercase", letterSpacing:".5px", fontWeight:600 }}>
        {cfg.teams.length} Teams — click a team to rename it
      </div>
      {cfg.teams.map((team, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:10, background:"#07101e", border:"1px solid #1a2d50", borderRadius:9, padding:"10px 14px" }}>
          {/* Color picker */}
          <div style={{ position:"relative" }}>
            <div onClick={()=>setShowPicker(showPicker===i?null:i)}
              style={{ width:28, height:28, borderRadius:"50%", background:team.color, cursor:"pointer", border:"2px solid #2a3d60", flexShrink:0 }} />
            {showPicker===i && (
              <div style={{ position:"absolute", top:36, left:0, zIndex:100, background:"#0c1830", border:"1px solid #1a2d50", borderRadius:10, padding:10, display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
                {PRESET_COLORS.map(c => (
                  <div key={c} onClick={()=>{ updTeam(i,"color",c); setShowPicker(null); }}
                    style={{ width:24, height:24, borderRadius:"50%", background:c, cursor:"pointer", border:`2px solid ${team.color===c?"#fff":"transparent"}` }} />
                ))}
                <div style={{ gridColumn:"1/-1", marginTop:4 }}>
                  <input type="color" value={team.color} onChange={e=>updTeam(i,"color",e.target.value)}
                    style={{ width:"100%", height:28, border:"none", borderRadius:4, cursor:"pointer", background:"none" }} />
                </div>
              </div>
            )}
          </div>
          {/* Name */}
          {editIdx===i ? (
            <input autoFocus style={{ ...wizInp, flex:1, padding:"6px 10px", fontSize:15 }} value={team.name}
              onChange={e=>updTeam(i,"name",e.target.value)} onBlur={()=>setEditIdx(null)}
              onKeyDown={e=>{ if(e.key==="Enter") setEditIdx(null); }} />
          ) : (
            <span onClick={()=>setEditIdx(i)} style={{ flex:1, fontSize:16, color:"#fff", fontWeight:600, cursor:"text" }}>{team.name}</span>
          )}
          <button onClick={()=>delTeam(i)} style={{ background:"none", border:"none", color:"#4a6080", fontSize:18, cursor:"pointer", padding:"0 4px", lineHeight:1 }}>✕</button>
        </div>
      ))}
      <button onClick={addTeam}
        style={{ padding:"10px 0", border:"1px dashed #1a2d50", borderRadius:9, background:"transparent", color:"#4a80c4", fontSize:15, fontWeight:700, cursor:"pointer", marginTop:4 }}>
        + Add Team
      </button>
    </div>
  );
}

/* Step 3: Rules */
function Step3Rules({ cfg, onChange }: { cfg: AuctionConfig; onChange:(c:AuctionConfig)=>void }) {
  const upd = (key: keyof RulesConfig, val: number) => onChange({ ...cfg, rules: { ...cfg.rules, [key]: val } });
  const field = (label: string, key: keyof RulesConfig, min: number, step: number, prefix = "₹") => (
    <div key={key}>
      <label style={wizLbl}>{label}</label>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        {prefix && <span style={{ color:"#f0c040", fontWeight:700, fontSize:18 }}>{prefix}</span>}
        <input type="number" style={{ ...wizInp, width:200 }} min={min} step={step}
          value={cfg.rules[key]} onChange={e=>upd(key, Math.max(min, parseInt(e.target.value,10)||min))} />
      </div>
    </div>
  );
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {field("Total Purse per Team", "totalPurse", 1000, 500)}
      {field("Minimum Players Required", "minPlayers", 1, 1, "")}
      {field("Bid Step", "bidStep", 10, 10)}
      {field("Default Base Price", "defaultBasePrice", 100, 50)}
      <div style={{ background:"#070f1e", border:"1px solid #1a2d50", borderRadius:8, padding:"12px 14px", fontSize:14, color:"#4a6080", lineHeight:1.8 }}>
        Teams start with {fmt(cfg.rules.totalPurse)} · Bids raise in {fmt(cfg.rules.bidStep)} steps ·
        Players start at {fmt(cfg.rules.defaultBasePrice)} minimum · Each team must buy ≥{cfg.rules.minPlayers} players
      </div>
    </div>
  );
}

/* Step 4: Players / CSV */
function Step4Players({ cfg, onChange, onPlayers }: {
  cfg: AuctionConfig;
  onChange:(c:AuctionConfig)=>void;
  onPlayers:(ps:Player[])=>void;
}) {
  const [source,  setSource]  = useState<"url"|"file">("url");
  const [url,     setUrl]     = useState(cfg.csv.url);
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [headers,   setHeaders]   = useState<string[]>([]);
  const [colMap,    setColMap]    = useState<Partial<ColumnMap>>(cfg.csv.columnMap);
  const [status,    setStatus]    = useState<"idle"|"detecting"|"ready"|"loading"|"done"|"error">("idle");
  const [playerCount, setPlayerCount] = useState(0);
  const [errMsg,    setErrMsg]    = useState("");

  const resetHeaders = () => { setHeaders([]); setStatus("idle"); setErrMsg(""); };
  const applyHeaders = (h: string[]) => {
    if (!h.length) { setErrMsg("No column headers found in this file."); setStatus("error"); return; }
    setHeaders(h);
    setColMap({ ...autoMap(h), ...cfg.csv.columnMap });
    setStatus("ready");
  };

  // ── URL source ──────────────────────────────────────────────────────────────
  const detectFromUrl = async (targetUrl = url) => {
    if (!targetUrl.trim()) { alert("Paste a CSV URL first."); return; }
    setStatus("detecting"); setErrMsg("");
    try { applyHeaders(await fetchHeaders(targetUrl.trim())); }
    catch (e: unknown) { setErrMsg(e instanceof Error ? e.message : "Could not reach URL."); setStatus("error"); }
  };

  // Auto-detect headers on mount if a URL is already set (e.g. wizard re-opened)
  useEffect(() => {
    if (url.trim() && status === "idle") detectFromUrl(url);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── File source ─────────────────────────────────────────────────────────────
  const readFile = (file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv" && !file.type.includes("spreadsheet")) {
      setErrMsg("Please choose a .csv file."); setStatus("error"); return;
    }
    setFileName(file.name); setStatus("detecting"); setErrMsg("");
    const rd = new FileReader();
    rd.onload = ev => {
      const text = ev.target?.result as string;
      setRawText(text);
      applyHeaders(headersFromText(text));
    };
    rd.onerror = () => { setErrMsg("Failed to read file."); setStatus("error"); };
    rd.readAsText(file);
  };

  // ── Load players ────────────────────────────────────────────────────────────
  const loadPlayers = async () => {
    setStatus("loading");
    try {
      let ps: Player[];
      if (source === "url") {
        onChange({ ...cfg, csv: { url: url.trim(), columnMap: colMap } });
        ps = await fetchPlayers(url.trim(), colMap, cfg.rules.defaultBasePrice);
      } else {
        onChange({ ...cfg, csv: { url: "", columnMap: colMap } });
        ps = parseCSVText(rawText, colMap, cfg.rules.defaultBasePrice);
      }
      if (!ps.length) throw new Error("No players found. Check column mapping.");
      setPlayerCount(ps.length);
      onPlayers(ps);
      setStatus("done");
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : "Failed to parse players.");
      setStatus("error");
    }
  };

  const setMap = (key: keyof ColumnMap, val: string) => setColMap(m => ({ ...m, [key]: val }));

  const switchSource = (s: "url"|"file") => { setSource(s); resetHeaders(); setRawText(""); setFileName(""); };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* Source selector */}
      <div style={{ display:"flex", border:"1px solid #1a2d50", borderRadius:10, overflow:"hidden" }}>
        {([
          { key:"url",  label:"🔗 Google Forms / Sheets URL" },
          { key:"file", label:"📁 Upload CSV from device" },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={()=>switchSource(key)}
            style={{ flex:1, padding:"12px 0", border:"none", cursor:"pointer", fontSize:14, fontWeight:700,
              background: source===key?"#1a2d50":"transparent",
              color: source===key?"#90a4d4":"#4a6080",
              borderRight: key==="url"?"1px solid #1a2d50":"none" }}>
            {label}
          </button>
        ))}
      </div>

      {/* URL panel */}
      {source === "url" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <label style={wizLbl}>Published CSV URL</label>
          <div style={{ display:"flex", gap:8 }}>
            <input style={{ ...wizInp, flex:1 }} value={url} placeholder="Paste Google Sheets CSV link…"
              onChange={e=>{ setUrl(e.target.value); resetHeaders(); }} />
            <button onClick={()=>detectFromUrl()} disabled={status==="detecting"}
              style={{ padding:"10px 18px", border:"none", borderRadius:8, fontSize:15, fontWeight:700, cursor:"pointer",
                background: status==="detecting"?"#1a2d50":"#1e3a6e", color:"#90a4d4" }}>
              {status==="detecting" ? "…" : "Detect"}
            </button>
          </div>
          <div style={{ fontSize:12, color:"#3d5070", lineHeight:1.6 }}>
            In Google Sheets: <b style={{ color:"#6a80aa" }}>File → Share → Publish to web → CSV → Copy link</b>
          </div>
        </div>
      )}

      {/* File upload panel */}
      {source === "file" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <label style={wizLbl}>CSV File</label>
          <label
            onDragOver={e=>{ e.preventDefault(); setIsDragging(true); }}
            onDragLeave={()=>setIsDragging(false)}
            onDrop={e=>{ e.preventDefault(); setIsDragging(false); const f=e.dataTransfer.files?.[0]; if(f) readFile(f); }}
            style={{ display:"block", cursor:"pointer" }}>
            <div style={{
              border: `2px dashed ${isDragging?"#f0c040":"#1a2d50"}`,
              borderRadius:10, padding:"28px 20px", textAlign:"center",
              background: isDragging?"#0e1e10":"#07101e", transition:"all .15s",
            }}>
              {fileName ? (
                <div>
                  <div style={{ fontSize:22, marginBottom:6 }}>📄</div>
                  <div style={{ fontSize:15, color:"#90a4d4", fontWeight:700 }}>{fileName}</div>
                  <div style={{ fontSize:13, color:"#4a6080", marginTop:4 }}>Click to choose a different file</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize:28, marginBottom:8 }}>📂</div>
                  <div style={{ fontSize:15, color:"#6a80aa", fontWeight:600 }}>Drop a CSV file here</div>
                  <div style={{ fontSize:13, color:"#3d5070", marginTop:4 }}>or click to browse</div>
                </div>
              )}
            </div>
            <input type="file" accept=".csv,text/csv" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(f) readFile(f); }} />
          </label>
          <div style={{ fontSize:12, color:"#3d5070", lineHeight:1.6 }}>
            Export your Google Sheet as <b style={{ color:"#6a80aa" }}>File → Download → CSV (.csv)</b> then upload here.
          </div>
        </div>
      )}

      {/* Error */}
      {status==="error" && <div style={{ color:"#ff5f57", fontSize:14, background:"#1a0808", border:"1px solid #3a1010", borderRadius:8, padding:"10px 14px" }}>{errMsg}</div>}

      {/* Column mapping (shared for both sources) */}
      {headers.length > 0 && (
        <div>
          <label style={{ ...wizLbl, marginBottom:10 }}>Column Mapping</label>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {COL_CONCEPTS.map(({ key, label, required }) => (
              <div key={key} style={{ display:"grid", gridTemplateColumns:"140px 1fr", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:14, color:required?"#f0c040":"#8899bb", fontWeight:600 }}>
                  {label}{required && " *"}
                </span>
                <select value={colMap[key]||""} onChange={e=>setMap(key,e.target.value)}
                  style={{ ...wizInp, padding:"7px 10px", fontSize:14, cursor:"pointer" }}>
                  <option value="">(none)</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button onClick={loadPlayers} disabled={!colMap.name || status==="loading"}
            style={{ marginTop:16, padding:"11px 22px", border:"none", borderRadius:8, fontSize:15, fontWeight:700,
              cursor: colMap.name?"pointer":"not-allowed",
              background: colMap.name?"#1a4a2a":"#111f3a", color: colMap.name?"#4caf50":"#4a6080" }}>
            {status==="loading" ? "Loading players…" : "Load & Preview Players"}
          </button>
          {status==="done" && (
            <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:8, color:"#30d158", fontSize:15, fontWeight:700 }}>
              <span>✓</span> {playerCount} players loaded successfully
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* Step 5: Review */
function Step5Review({ cfg, playerCount }: { cfg: AuctionConfig; playerCount: number }) {
  const rows = [
    { label: "League",       value: `${cfg.league.name} ${cfg.league.year}` },
    { label: "Teams",        value: `${cfg.teams.length} teams` },
    { label: "Players",      value: playerCount > 0 ? `${playerCount} players loaded` : "⚠ No players loaded (go back to Step 4)" },
    { label: "Purse / team", value: fmt(cfg.rules.totalPurse) },
    { label: "Min players",  value: String(cfg.rules.minPlayers) },
    { label: "Bid step",     value: fmt(cfg.rules.bidStep) },
    { label: "Base price",   value: fmt(cfg.rules.defaultBasePrice) },
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0, background:"#07101e", border:"1px solid #1a2d50", borderRadius:12, overflow:"hidden" }}>
      {rows.map(({ label, value }, i) => (
        <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"14px 18px", borderBottom: i<rows.length-1?"1px solid #111f3a":"none",
          background: i%2===0?"transparent":"#06101e" }}>
          <span style={{ color:"#6a80aa", fontSize:15 }}>{label}</span>
          <span style={{ color: value.startsWith("⚠")?"#ff9800":"#fff", fontWeight:700, fontSize:15 }}>{value}</span>
        </div>
      ))}
      <div style={{ padding:"12px 18px", borderTop:"1px solid #1a2d50" }}>
        <div style={{ fontSize:13, color:"#4a6080", marginBottom:8 }}>Teams</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {cfg.teams.map(t => (
            <div key={t.name} style={{ display:"flex", alignItems:"center", gap:6, background:"#0c1830", border:"1px solid #1a2d50", borderRadius:20, padding:"4px 12px" }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:t.color }} />
              <span style={{ fontSize:14, color:"#fff", fontWeight:600 }}>{t.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Setup Wizard orchestrator */
function SetupWizard({ existingConfig, onLaunch, user }: {
  existingConfig: AuctionConfig | null;
  user: string | null;
  onLaunch: (cfg: AuctionConfig, players: Player[]) => void;
}) {
  const [step, setStep] = useState(1);
  const [cfg, setCfg] = useState<AuctionConfig>(existingConfig ?? DEFAULT_CONFIG);
  const [players, setPlayers] = useState<Player[]>([]);

  const canAdvance = step !== 4 || players.length > 0;

  const next = () => { if (step < 5 && canAdvance) setStep(s => s+1); };
  const back = () => { if (step > 1) setStep(s => s-1); };
  const launch = () => {
    if (!players.length) { alert("Load players first (Step 4)."); return; }
    wrCfg(cfg); clrState();
    onLaunch(cfg, players);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#030710", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ width:"100%", maxWidth:620, background:"#07101e", border:"1px solid #1a2d50", borderRadius:16, overflow:"hidden" }}>
        {/* Header */}
        <div style={{ background:"#0a1528", borderBottom:"1px solid #1a2d50", padding:"20px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontSize:22, fontWeight:800, color:"#f0c040", letterSpacing:".5px" }}>Auction Setup</div>
            <div style={{ fontSize:14, color:"#4a6080", marginTop:3 }}>Configure your auction before going live</div>
          </div>
          <UserBadge user={user} />
        </div>
        {/* Body */}
        <div style={{ padding:"28px 28px 20px" }}>
          <StepBar step={step} />
          <div style={{ minHeight:320 }}>
            {step === 1 && <Step1League cfg={cfg} onChange={setCfg} />}
            {step === 2 && <Step2Teams cfg={cfg} onChange={setCfg} />}
            {step === 3 && <Step3Rules cfg={cfg} onChange={setCfg} />}
            {step === 4 && <Step4Players cfg={cfg} onChange={setCfg} onPlayers={setPlayers} />}
            {step === 5 && <Step5Review cfg={cfg} playerCount={players.length} />}
          </div>
        </div>
        {/* Footer */}
        <div style={{ padding:"16px 28px", borderTop:"1px solid #1a2d50", background:"#0a1528", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <button onClick={back} disabled={step===1}
            style={{ padding:"10px 22px", border:"1px solid #1a2d50", borderRadius:8, fontSize:15, fontWeight:700, cursor:step===1?"not-allowed":"pointer",
              background:"transparent", color: step===1?"#2a3d60":"#8899bb", opacity:step===1?0.5:1 }}>
            ← Back
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {step === 4 && !canAdvance && (
              <span style={{ fontSize:13, color:"#f0c040" }}>Load players first ↑</span>
            )}
            {step < 5 ? (
              <button onClick={next} disabled={!canAdvance}
                style={{ padding:"10px 26px", border:"none", borderRadius:8, fontSize:15, fontWeight:700,
                  cursor: canAdvance ? "pointer" : "not-allowed",
                  background: canAdvance ? "#f0c040" : "#2a3010",
                  color: canAdvance ? "#050a14" : "#6a7030",
                  opacity: canAdvance ? 1 : 0.7 }}>
                Next →
              </button>
            ) : (
              <button onClick={launch} disabled={!players.length}
                style={{ padding:"10px 28px", border:"none", borderRadius:8, fontSize:16, fontWeight:800, cursor:players.length?"pointer":"not-allowed",
                  background: players.length?"#30d158":"#1a2d50", color: players.length?"#050a14":"#4a6080" }}>
                🚀 Launch Auction
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TEAM ROSTER MODAL
═══════════════════════════════════════════════════════════════════ */

const escHtml = (v: string|number|undefined|null) =>
  String(v ?? "—").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

/** HTML section for one team, using inline styles Word understands. */
function buildTeamHtml(team: Team, totalPurse: number) {
  const spent = totalPurse - team.purse;
  const avg = team.players.length ? Math.round(spent / team.players.length) : 0;
  const th = `style="border:1px solid #444;background:#1a2d50;color:#ffffff;padding:6px 8px;font-weight:bold;text-align:center;"`;
  const td = `style="border:1px solid #444;padding:6px 8px;text-align:center;"`;
  const tdL = `style="border:1px solid #444;padding:6px 8px;text-align:left;"`;
  const rows = team.players.length
    ? team.players.map((pl, i) => {
        const tags = pl.manuallyAdded ? "Manual Entry" : "";
        const loc = `${pl.city || ""}${pl.state && pl.state !== "—" ? `, ${pl.state}` : ""}` || "—";
        return `<tr>
          <td ${td}>${i + 1}</td>
          <td ${tdL}><b>${escHtml(pl.name)}</b>${tags ? ` <i style="color:#a05a00;">(${escHtml(tags)})</i>` : ""}</td>
          <td ${td}>${escHtml(pl.role)}</td>
          <td ${td}>${escHtml(loc)}</td>
          <td ${td}>${escHtml(pl.mobile || "—")}</td>
          <td ${td}><b>${escHtml(fmt(pl.soldPrice ?? pl.currentBid))}</b></td>
        </tr>`;
      }).join("")
    : `<tr><td ${td} colspan="6">No players bought yet</td></tr>`;
  return `
    <h2 style="color:${escHtml(team.color)};font-family:Calibri,Arial,sans-serif;margin:0 0 8px;">${escHtml(team.name)}</h2>
    <table style="border-collapse:collapse;margin-bottom:12px;font-family:Calibri,Arial,sans-serif;font-size:11pt;">
      <tr><th ${th}>Players</th><th ${th}>Purse Spent</th><th ${th}>Purse Left</th><th ${th}>Avg Bid</th></tr>
      <tr><td ${td}>${team.players.length}</td><td ${td}>${escHtml(fmt(spent))}</td><td ${td}>${escHtml(fmt(team.purse))}</td><td ${td}>${team.players.length ? escHtml(fmt(avg)) : "—"}</td></tr>
    </table>
    <table style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt;">
      <tr><th ${th}>#</th><th ${th}>Player</th><th ${th}>Role</th><th ${th}>City / State</th><th ${th}>Mobile</th><th ${th}>Bid Price</th></tr>
      ${rows}
    </table>`;
}

/** Word-compatible .doc (HTML with Office namespaces) containing one or more teams. */
function buildTeamsDoc(title: string, teamList: Team[], totalPurse: number): Blob {
  const sections = teamList.map((t, i) =>
    `${i > 0 ? `<br style="page-break-before:always;mso-break-type:page-break;" clear="all">` : ""}${buildTeamHtml(t, totalPurse)}`
  ).join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escHtml(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>@page { size: A4; margin: 1.5cm; } body { font-family: Calibri, Arial, sans-serif; }</style>
</head><body>
<h1 style="font-family:Calibri,Arial,sans-serif;color:#1a2d50;margin:0 0 4px;">${escHtml(title)}</h1>
<p style="color:#666;margin:0 0 14px;">Generated ${escHtml(new Date().toLocaleString("en-IN"))}</p>
${sections}
</body></html>`;
  return new Blob(["﻿", html], { type: "application/msword" });
}

/** PDF with summary + players table per team (one team per page). Uses "Rs." since built-in PDF fonts lack the ₹ glyph. */
function buildTeamsPdf(title: string, teamList: Team[], totalPurse: number): Blob {
  const money = (n: number) => "Rs. " + Number(n).toLocaleString("en-IN");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 40;
  const lastY = () => (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 0;
  const generated = `Generated ${new Date().toLocaleString("en-IN")}`;

  teamList.forEach((team, idx) => {
    if (idx > 0) doc.addPage();
    let y = 48;
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor("#1a2d50");
    doc.text(title, marginX, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor("#666666");
    doc.text(generated, marginX, y += 14);
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(team.color || "#1a2d50");
    doc.text(team.name, marginX, y += 28);

    const spent = totalPurse - team.purse;
    const avg = team.players.length ? Math.round(spent / team.players.length) : 0;
    const head = { fillColor: "#1a2d50", textColor: "#ffffff", fontStyle: "bold" as const, halign: "center" as const };
    autoTable(doc, {
      startY: y + 10, margin: { left: marginX, right: marginX }, theme: "grid",
      headStyles: head, styles: { halign: "center", fontSize: 10 },
      head: [["Players", "Purse Spent", "Purse Left", "Avg Bid"]],
      body: [[String(team.players.length), money(spent), money(team.purse), team.players.length ? money(avg) : "-"]],
    });

    const body = team.players.length
      ? team.players.map((pl, i) => {
          const loc = `${pl.city || ""}${pl.state && pl.state !== "—" ? `, ${pl.state}` : ""}` || "-";
          return [String(i + 1), pl.manuallyAdded ? `${pl.name}\n(Manual Entry)` : pl.name, pl.role || "-", loc, pl.mobile || "-", money(pl.soldPrice ?? pl.currentBid)];
        })
      : [[{ content: "No players bought yet", colSpan: 6 }]];
    autoTable(doc, {
      startY: lastY() + 14, margin: { left: marginX, right: marginX }, theme: "grid",
      headStyles: head, styles: { halign: "center", valign: "middle", fontSize: 10, cellPadding: 5 },
      alternateRowStyles: { fillColor: "#f2f5fa" },
      columnStyles: { 0: { cellWidth: 26 }, 1: { halign: "left", fontStyle: "bold" }, 5: { fontStyle: "bold" } },
      head: [["#", "Player", "Role", "City / State", "Mobile", "Bid Price"]],
      body,
    });
  });
  return doc.output("blob");
}

const safeFileName =(s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "team";

function TeamRoster({ teams, config, onClose }: { teams: Team[]; config: AuctionConfig; onClose:()=>void }) {
  const [tab, setTab] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);
  const team = teams[tab];
  const { totalPurse, minPlayers } = config.rules;
  const spent = totalPurse - team.purse;

  const makeDoc = (list: Team[], label: string) => {
    const title = `SPL Auction - ${label}`;
    const blob = buildTeamsDoc(title, list, totalPurse);
    const fileName = `SPL_${safeFileName(label)}_${new Date().toISOString().slice(0,10)}.doc`;
    return { title, blob, fileName };
  };
  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  // "Copy" → download the Word document.
  const downloadDoc = (list: Team[], label: string) => {
    const { blob, fileName } = makeDoc(list, label);
    downloadBlob(blob, fileName);
  };
  // "Send" → share a PDF as a file (WhatsApp appears in the share sheet on phones).
  const sendDoc = async (list: Team[], label: string) => {
    const title = `SPL Auction - ${label}`;
    const blob = buildTeamsPdf(title, list, totalPurse);
    const fileName = `SPL_${safeFileName(label)}_${new Date().toISOString().slice(0,10)}.pdf`;
    const file = new File([blob], fileName, { type: "application/pdf" });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title }); return; }
      catch (e) { if ((e as Error).name === "AbortError") return; }
    }
    // Desktop browsers can't attach files to WhatsApp: download it and open WhatsApp to attach manually.
    downloadBlob(blob, fileName);
    alert(`${fileName} downloaded.\n\nWhatsApp will open now — attach the downloaded file in the chat.`);
    window.open("https://web.whatsapp.com/", "_blank", "noopener,noreferrer");
  };
  const downloadImg = async () => {
    if (!tableRef.current) return;
    try {
      const tmp = document.createElement("div");
      tmp.style.cssText = "position:absolute;top:-9999px;left:-9999px;background:#07101e;padding:20px;border-radius:8px;";
      const clone = tableRef.current.cloneNode(true) as HTMLElement;
      clone.style.overflow="visible"; clone.style.maxHeight="none"; clone.style.maxWidth="900px";
      tmp.appendChild(clone); document.body.appendChild(tmp);
      const canvas = await html2canvas(tmp, { backgroundColor:"#07101e", scale:2, useCORS:true, logging:false });
      document.body.removeChild(tmp);
      const a = document.createElement("a"); a.href=canvas.toDataURL("image/png");
      a.download=`${team.name}_players_${Date.now()}.png`; a.click();
    } catch { alert("Failed to download."); }
  };


  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.88)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
      <div style={{ background:"#07101e", border:"1px solid #1a2d50", borderRadius:16, width:"min(98vw,1400px)", maxHeight:"94vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ background:"#0a1528", padding:"16px 22px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid #1a2d50" }}>
          <span style={{ fontSize:20, fontWeight:800, color:"#f0c040", letterSpacing:".5px" }}>Team Rosters</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#4a6080", fontSize:24, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ display:"flex", borderBottom:"1px solid #1a2d50", overflowX:"auto", background:"#06101e" }}>
          {teams.map((t,i) => (
            <button key={t.name} onClick={()=>setTab(i)}
              style={{ padding:"10px 20px", border:"none", cursor:"pointer", fontSize:15, fontWeight:700,
                borderBottom:`3px solid ${tab===i?t.color:"transparent"}`, background:"transparent",
                color: tab===i?t.color:"#4a6080", whiteSpace:"nowrap" }}>
              {t.name}
              <span style={{ marginLeft:6, fontSize:13, background:"#111f3a", color:"#6a80aa", padding:"1px 7px", borderRadius:20 }}>{t.players.length}</span>
            </button>
          ))}
        </div>
        <div style={{ display:"flex", gap:28, padding:"14px 22px", borderBottom:"1px solid #1a2d50", background:"#060e1b", flexWrap:"wrap" }}>
          {[
            { label:"Players",     val:`${team.players.length}/${minPlayers} min`,                      color:team.players.length>=minPlayers?"#30d158":"#f0c040" },
            { label:"Purse spent", val:fmt(spent),                                                      color:"#f0c040" },
            { label:"Purse left",  val:fmt(team.purse),                                                 color:team.purse<1000?"#ff5f57":"#30d158" },
            { label:"Avg bid",     val:team.players.length?fmt(Math.round(spent/team.players.length)):"—", color:"#90a4d4" },
          ].map(s => (
            <div key={s.label} style={{ textAlign:"center", minWidth:90 }}>
              <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.val}</div>
              <div style={{ fontSize:12, color:"#4a6080", textTransform:"uppercase", letterSpacing:".5px", marginTop:2 }}>{s.label}</div>
            </div>
          ))}
          <div style={{ flex:1, minWidth:160, display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ flex:1, height:5, background:"#111f3a", borderRadius:4, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${(team.purse/totalPurse)*100}%`, background:team.purse<1000?"#ff5f57":team.color, borderRadius:4, transition:"width .3s" }} />
            </div>
            <span style={{ fontSize:13, color:"#4a6080", whiteSpace:"nowrap" }}>{Math.round((team.purse/totalPurse)*100)}% left</span>
          </div>
        </div>
        <div style={{ padding:"10px 22px", borderBottom:"1px solid #1a2d50", background:"#07121f", display:"flex", gap:8, flexWrap:"wrap" }}>
          {[
            { label:"Copy Team", onClick:()=>downloadDoc([team], team.name), bg:"#111f3a", color:"#90a4d4" },
            { label:"Send Team", onClick:()=>sendDoc([team], team.name),     bg:"#0d2b0d", color:"#4caf50" },
            { label:"Copy All",  onClick:()=>downloadDoc(teams, "All Teams"), bg:"#0a1830", color:"#90a4d4" },
            { label:"Send All",  onClick:()=>sendDoc(teams, "All Teams"),     bg:"#0d2b0d", color:"#4caf50" },
          ].map(b => (
            <button key={b.label} onClick={b.onClick}
              style={{ padding:"7px 14px", border:"1px solid #1a2d50", borderRadius:7, fontSize:14, cursor:"pointer", fontWeight:700, background:b.bg, color:b.color }}>
              {b.label}
            </button>
          ))}
          {team.players.length >= minPlayers && (
            <button onClick={downloadImg}
              style={{ padding:"7px 14px", border:"1px solid #3a2800", borderRadius:7, fontSize:14, cursor:"pointer", fontWeight:700, background:"#2b1f00", color:"#f0c040" }}>
              📸 Download Image
            </button>
          )}
        </div>
        <div ref={tableRef} style={{ overflowY:"auto", overflowX:"auto", flex:1 }}>
          {team.players.length === 0 ? (
            <div style={{ padding:40, textAlign:"center", color:"#4a6080", fontSize:18 }}>No players bought yet</div>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:16 }}>
              <thead>
                <tr style={{ background:"#0a1528", position:"sticky", top:0 }}>
                  {["#","Photo","Player","Role","City / State","Mobile","Bid"].map(h => (
                    <th key={h} style={{ padding:"10px 16px", textAlign:"center", color:"#4a6080", fontWeight:700, fontSize:13, textTransform:"uppercase", letterSpacing:".5px", borderBottom:"1px solid #1a2d50" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {team.players.map((pl,i) => (
                  <tr key={pl.serialNo} style={{ borderBottom:"1px solid #0a1528", background:i%2===0?"transparent":"#060e1b" }}>
                    <td style={{ padding:"10px 16px", color:"#4a6080", textAlign:"center" }}>{pl.serialNo}</td>
                    <td style={{ padding:"8px 16px", textAlign:"center" }}><div style={{ display:"flex", justifyContent:"center" }}><PhotoAvatar photo={pl.photo} name={pl.name} size={34} /></div></td>
                    <td style={{ padding:"10px 16px", color:"#fff", fontWeight:600, textAlign:"center" }}>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                        {pl.name}
                        {pl.availabilityUncertain && <span style={{ fontSize:12, padding:"1px 7px", borderRadius:20, fontWeight:700, ...UNCERTAIN_BADGE }}>May/May Not</span>}
                        {pl.manuallyAdded && <span style={{ fontSize:12, padding:"1px 7px", borderRadius:20, fontWeight:700, ...MANUAL_BADGE }}>Manual</span>}
                      </div>
                    </td>
                    <td style={{ padding:"10px 16px", textAlign:"center" }}>
                      <span style={{ fontSize:13, padding:"2px 8px", borderRadius:20, fontWeight:600, ...(ROLE_STYLE[pl.role]??{background:"#1a2d50",color:"#90a4d4",border:"1px solid #2a3d6a"}) }}>{pl.role}</span>
                    </td>
                    <td style={{ padding:"10px 16px", color:"#6a80aa", textAlign:"center" }}>{pl.city}{pl.state&&pl.state!=="—"?`, ${pl.state}`:""}</td>
                    <td style={{ padding:"10px 16px", color:"#6a80aa", textAlign:"center" }}>{pl.mobile||"—"}</td>
                    <td style={{ padding:"10px 16px", color:"#f0c040", fontWeight:800, textAlign:"center" }}>{fmt(pl.soldPrice??pl.currentBid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ADD PLAYER MODAL
═══════════════════════════════════════════════════════════════════ */

function AddPlayerModal({ nextSerial, config, onAdd, onClose }: {
  nextSerial: number; config: AuctionConfig; onAdd:(p:Player)=>void; onClose:()=>void;
}) {
  const [form, setForm] = useState({ name:"", mobile:"", role:"Batsman", batting:"Right Hand", bowling:"N/A", city:"", state:"", basePrice:String(config.rules.defaultBasePrice), photo:"", availabilityUncertain:false });
  const [photoTab, setPhotoTab] = useState<"upload"|"url">("upload");
  const [preview, setPreview] = useState("");
  const set = <K extends keyof typeof form>(k:K, v:(typeof form)[K]) => setForm(f=>({...f,[k]:v}));

  const submit = () => {
    if (!form.name.trim()) { alert("Player name is required."); return; }
    const bp = Math.max(config.rules.defaultBasePrice, parseInt(form.basePrice,10)||config.rules.defaultBasePrice);
    onAdd(normPlayer({ serialNo:nextSerial, name:form.name.trim(), mobile:form.mobile.trim(), role:form.role, batting:form.batting, bowling:form.bowling, city:form.city.trim()||"—", state:form.state.trim()||"—", photo:form.photo.trim(), basePrice:bp, currentBid:bp, availabilityUncertain:form.availabilityUncertain, manuallyAdded:true, status:"available" }, nextSerial, config.rules.defaultBasePrice));
    onClose();
  };
  const inp: React.CSSProperties = { width:"100%", background:"#0a1428", border:"1px solid #1a2d50", borderRadius:7, padding:"9px 12px", fontSize:16, color:"#fff", outline:"none" };
  const lbl: React.CSSProperties = { fontSize:13, color:"#6a80aa", marginBottom:5, display:"block", textTransform:"uppercase", letterSpacing:".5px", fontWeight:600 };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.88)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1100 }}>
      <div style={{ background:"#07101e", border:"1px solid #1a2d50", borderRadius:16, width:"min(95vw,520px)", maxHeight:"92vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ background:"#0a1528", padding:"16px 22px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid #1a2d50" }}>
          <span style={{ fontSize:20, fontWeight:800, color:"#f0c040" }}>Add Player</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#4a6080", fontSize:24, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ overflowY:"auto", padding:22, display:"flex", flexDirection:"column", gap:16 }}>
          <div><label style={lbl}>Name *</label><input style={inp} value={form.name} placeholder="Full name" onChange={e=>set("name",e.target.value)} /></div>
          <div><label style={lbl}>Phone Number</label><input style={inp} value={form.mobile} placeholder="Mobile number" onChange={e=>set("mobile",e.target.value)} /></div>
          <label style={{ display:"flex", alignItems:"flex-start", gap:10, background:"#060e1b", border:"1px solid #1a2d50", borderRadius:8, padding:"12px 14px", cursor:"pointer" }}>
            <input type="checkbox" checked={form.availabilityUncertain} onChange={e=>set("availabilityUncertain",e.target.checked)} style={{ marginTop:3 }} />
            <span>
              <span style={{ display:"block", fontSize:16, color:"#fff", fontWeight:600 }}>May or may not be playing</span>
              <span style={{ display:"block", fontSize:14, color:"#4a6080", marginTop:3 }}>Adds a marker throughout the auction and roster views.</span>
            </span>
          </label>
          <div style={{ display:"flex", gap:12 }}>
            <div style={{ flex:1 }}><label style={lbl}>Role</label><select style={{ ...inp, cursor:"pointer" }} value={form.role} onChange={e=>set("role",e.target.value)}><option>Batsman</option><option>Bowler</option><option>All-Rounder</option><option>Wicket Keeper</option></select></div>
            <div style={{ flex:1 }}><label style={lbl}>Batting</label><select style={{ ...inp, cursor:"pointer" }} value={form.batting} onChange={e=>set("batting",e.target.value)}><option>Right Hand</option><option>Left Hand</option></select></div>
          </div>
          <div><label style={lbl}>Bowling</label><select style={{ ...inp, cursor:"pointer" }} value={form.bowling} onChange={e=>set("bowling",e.target.value)}><option>N/A</option><option>Right Arm Fast</option><option>Left Arm Fast</option><option>Right Arm Spin</option><option>Left Arm Spin</option></select></div>
          <div style={{ display:"flex", gap:12 }}>
            <div style={{ flex:1 }}><label style={lbl}>City</label><input style={inp} value={form.city} placeholder="City" onChange={e=>set("city",e.target.value)} /></div>
            <div style={{ flex:1 }}><label style={lbl}>State</label><input style={inp} value={form.state} placeholder="State" onChange={e=>set("state",e.target.value)} /></div>
          </div>
          <div><label style={lbl}>Base Price (₹) — min {fmt(config.rules.defaultBasePrice)}</label><input type="number" style={inp} value={form.basePrice} min={config.rules.defaultBasePrice} step={config.rules.bidStep} onChange={e=>set("basePrice",e.target.value)} /></div>
          <div>
            <label style={lbl}>Photo (optional)</label>
            <div style={{ display:"flex", marginBottom:10, border:"1px solid #1a2d50", borderRadius:8, overflow:"hidden" }}>
              {(["upload","url"] as const).map(t => (
                <button key={t} onClick={()=>{ setPhotoTab(t); set("photo",""); setPreview(""); }}
                  style={{ flex:1, padding:"7px 0", border:"none", cursor:"pointer", fontSize:14, fontWeight:700, background:photoTab===t?"#1a2d50":"transparent", color:photoTab===t?"#90a4d4":"#4a6080" }}>
                  {t==="upload"?"📁 Upload":"🔗 URL"}
                </button>
              ))}
            </div>
            {photoTab==="upload" ? (
              <label style={{ display:"block", cursor:"pointer" }}
                onDragOver={e=>e.preventDefault()}
                onDrop={e=>{ e.preventDefault(); const f=e.dataTransfer.files?.[0]; if(f&&f.type.startsWith("image/")){ const rd=new FileReader(); rd.onload=ev=>{ const d=ev.target?.result as string; setPreview(d); set("photo",d); }; rd.readAsDataURL(f); } }}>
                <div style={{ border:"2px dashed #1a2d50", borderRadius:8, padding:"20px 12px", textAlign:"center", color:"#4a6080", fontSize:15, background:"#060e1b" }}>
                  {preview && photoTab==="upload" ? <img src={preview} alt="preview" style={{ maxHeight:100, maxWidth:"100%", borderRadius:6, objectFit:"contain" }} /> : "Click or drag & drop an image"}
                </div>
                <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; const rd=new FileReader(); rd.onload=ev=>{ const d=ev.target?.result as string; setPreview(d); set("photo",d); }; rd.readAsDataURL(f); }} />
              </label>
            ) : (
              <div>
                <input style={inp} value={form.photo} placeholder="Paste Google Drive or image URL" onChange={e=>{ set("photo",e.target.value); setPreview(e.target.value); }} />
                {preview && <img src={preview} alt="preview" style={{ marginTop:8, maxHeight:90, maxWidth:"100%", borderRadius:6, objectFit:"contain", display:"block" }} onError={e=>(e.currentTarget.style.display="none")} />}
              </div>
            )}
          </div>
        </div>
        <div style={{ padding:"14px 22px", borderTop:"1px solid #1a2d50", background:"#0a1528", display:"flex", justifyContent:"flex-end", gap:10 }}>
          <button onClick={onClose} style={{ padding:"9px 18px", border:"1px solid #1a2d50", borderRadius:8, fontSize:16, cursor:"pointer", fontWeight:700, background:"transparent", color:"#6a80aa" }}>Cancel</button>
          <button onClick={submit} style={{ padding:"9px 22px", border:"none", borderRadius:8, fontSize:16, cursor:"pointer", fontWeight:800, background:"#f0c040", color:"#050a14" }}>Add to Auction</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AUCTION APP — BROADCAST STYLE
═══════════════════════════════════════════════════════════════════ */

function AuctionApp({ config, initPlayers, onSetup, user }: {
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
  const [lastSnapshot,  setLastSnapshot]  = useState<{ players: Player[]; teams: Team[] } | null>(null);
  const [activity,      setActivity]      = useState<ActivityEntry[]>([]);

  // Page: auction screen or full player list. Synced to the URL hash so browser Back works.
  const readView = (): "auction" | "players" => (window.location.hash === "#players" ? "players" : "auction");
  const [view, setView] = useState<"auction" | "players">(readView);
  useEffect(() => {
    const onHash = () => setView(readView());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const goTo = (v: "auction" | "players") => {
    if (v === "players") window.location.hash = "players";
    else history.pushState(null, "", window.location.pathname + window.location.search);
    setView(v);
    window.scrollTo(0, 0);
  };

  // Persist state
  useEffect(() => {
    wrState({ players, teams, cur, selTeam });
  }, [players, teams, cur, selTeam]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (view !== "auction") return;
      if (e.key === "ArrowRight") { e.preventDefault(); nextPlayer(); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); prevPlayer(); }
      if (e.key === "+" || e.key === "=") { e.preventDefault(); raiseBid(); }
      if (e.key === "-") { e.preventDefault(); lowerBid(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const p      = players[cur];
  const avail  = p?.status === "available";
  const canLow = !!p && avail && p.currentBid > p.basePrice;
  const canUns = !!p && avail && p.currentBid <= p.basePrice;
  const canNav = !p || !avail || p.currentBid <= p.basePrice;
  const sold     = players.filter(x => x.status === "sold").length;
  const unsold   = players.filter(x => x.status === "unsold").length;
  const remaining = players.filter(x => x.status === "available").length;

  function raiseBid() {
    if (!p || !avail) return;
    const next = p.currentBid + rules.bidStep;
    const bt = teams[selTeam];
    if (!canAfford(bt, next, rules.minPlayers, rules.defaultBasePrice)) {
      alert(`⚠️ ${bt.name} cannot afford ${fmt(next)}!\n\nPurse left: ${fmt(bt.purse)}\nMax bid: ${fmt(calcMax(bt, rules.minPlayers, rules.defaultBasePrice))}`);
      return;
    }
    setPlayers(prev => prev.map((pl,i) => i===cur ? { ...pl, currentBid:next } : pl));
    setBidKey(k => k+1);
  }
  function lowerBid() {
    if (!p || !avail) return;
    const next = Math.max(p.basePrice, p.currentBid - rules.bidStep);
    if (next === p.currentBid) return;
    setPlayers(prev => prev.map((pl,i) => i===cur ? { ...pl, currentBid:next } : pl));
    setBidKey(k => k+1);
  }
  function markSold() {
    if (!p || !avail) return;
    const bt = teams[selTeam];
    if (bt.purse < p.currentBid) { alert(`⚠️ ${bt.name} doesn't have enough purse!\nPurse: ${fmt(bt.purse)}\nBid: ${fmt(p.currentBid)}`); return; }
    if (!canAfford(bt, p.currentBid, rules.minPlayers, rules.defaultBasePrice)) {
      const needed = Math.max(0, rules.minPlayers - bt.players.length - 1);
      if (!window.confirm(`⚠️ Warning: ${bt.name} won't have enough for ${needed} more required player(s).\n\nProceed anyway?`)) return;
    }
    setLastSnapshot({ players, teams });
    const upd: Player = { ...p, status:"sold", soldTo:bt.name, soldPrice:p.currentBid };
    setPlayers(prev => prev.map((pl,i) => i===cur ? upd : pl));
    setTeams(prev => prev.map((t,i) => {
      if (i!==selTeam) return t;
      const ut = { ...t, purse:t.purse-p.currentBid, players:[...t.players, upd] };
      if (ut.players.length === rules.minPlayers) setTimeout(() => alert(`🎉 ${ut.name} completed their team with ${rules.minPlayers} players!`), 2600);
      return ut;
    }));
    setActivity(prev => [{ playerName:p.name, teamName:bt.name, teamColor:bt.color, price:p.currentBid, soldAt:Date.now() }, ...prev].slice(0, 8));
    setOverlay({ text:"SOLD!", price:`${fmt(p.currentBid)}  →  ${bt.name}`, teamColor:bt.color });
    setTimeout(() => setOverlay(null), 2500);
  }
  function markUnsold() {
    if (!p || !avail) return;
    if (p.currentBid > p.basePrice) { alert("Cannot mark unsold after a bid increase."); return; }
    setLastSnapshot({ players, teams });
    setPlayers(prev => prev.map((pl,i) => i===cur ? { ...pl, status:"unsold" } : pl));
    setOverlay({ text:"UNSOLD" });
    setTimeout(() => setOverlay(null), 1500);
  }
  function undoLast() {
    if (!lastSnapshot) return;
    setPlayers(lastSnapshot.players);
    setTeams(lastSnapshot.teams);
    setLastSnapshot(null);
    setOverlay(null);
  }
  function nextPlayer() {
    if (!canNav) { alert("Cannot advance — bid is above base price. Mark player SOLD first."); return; }
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
      setTimeout(() => setOverlay(null), 1800);
      return;
    }
    alert("Auction complete. No available players left.");
  }
  function prevPlayer() {
    if (!canNav) { alert("Cannot go back — bid is above base price. Mark player SOLD first."); return; }
    let prev = -1;
    for (let i=cur-1; i>=0; i--) { if (players[i].status==="available") { prev=i; break; } }
    if (prev===-1) for (let i=players.length-1; i>=0; i--) { if (players[i].status==="available") { prev=i; break; } }
    if (prev !== -1) { setCur(prev); setOverlay(null); return; }
    alert("No available players.");
  }
  function openSetup() {
    if (!window.confirm("⚙ Open Setup while the auction is live?\n\nLaunching the auction again from Setup will reset all bids and team assignments.")) return;
    onSetup();
  }
  function resetAll() {
    if (!window.confirm("🔄 Reset all bids and team assignments?\n\nThis cannot be undone.")) return;
    const rp = players.map(pl => ({ ...pl, status:"available" as Status, currentBid:pl.basePrice, soldTo:undefined, soldPrice:undefined }));
    const rt = config.teams.map(t => ({ ...t, purse:rules.totalPurse, players:[] }));
    setPlayers(rp); setTeams(rt); setCur(0); setSelTeam(0); setOverlay(null); setFilter("all");
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
  function jumpToSerial(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const n = parseInt(search.trim(), 10);
    if (isNaN(n)) return;
    const idx = players.findIndex(x => x.serialNo === n);
    if (idx !== -1) { setCur(idx); setOverlay(null); setSearch(""); goTo("auction"); }
    else alert(`No player #${n} found.`);
  }

  const filtered = filter === "all" ? players
    : filter === "uncertain" ? players.filter(x => x.availabilityUncertain)
    : players.filter(x => x.role === filter);

  const totalSpent = teams.reduce((a,t) => a + (rules.totalPurse - t.purse), 0);
  const highestBid = sold > 0 ? Math.max(...players.filter(p=>p.soldPrice).map(p=>p.soldPrice!)) : 0;

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
                <button className="cbtn" onClick={openSetup}
                  style={{ padding:"8px 14px", border:"1px solid #1a2d50", borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:700, background:"#0a1528", color:"#6a80aa" }}>
                  ⚙ Setup
                </button>
                <button className="cbtn" onClick={resetAll}
                  style={{ padding:"8px 14px", border:"1px solid #3a1010", borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:700, background:"#1e0808", color:"#ff5f57" }}>
                  🔄
                </button>
                <UserBadge user={user} />
              </div>
            </div>
          </div>

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
                    {/* Prices — right of photo */}
                    <div style={{ width:"clamp(200px, 34%, 300px)", flexShrink:0, borderLeft:"1px solid #1a2d50", background:"#060e1b",
                      display:"flex", flexDirection:"column", justifyContent:"center", gap:28, padding:"20px 22px" }}>
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

                  {/* Name + badges — below photo, fully readable */}
                  <div style={{ padding:"14px 18px 10px", borderBottom:"1px solid #111f3a" }}>
                    <div style={{ fontSize:30, fontWeight:900, color:"#fff", lineHeight:1.1, letterSpacing:".3px", marginBottom:10 }}>
                      {p.name}
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                      <span style={{ fontSize:13, padding:"3px 10px", borderRadius:20, fontWeight:700, ...(ROLE_STYLE[p.role]??{ background:"#1a2d50", color:"#90a4d4", border:"1px solid #2a3d6a" }) }}>{p.role}</span>
                      <span style={{ fontSize:13, padding:"3px 10px", borderRadius:20, fontWeight:700, background:"#1a2d50", color:"#8899bb", border:"1px solid #2a3d6a" }}>{p.batting}</span>
                      {p.bowling !== "N/A" && <span style={{ fontSize:13, padding:"3px 10px", borderRadius:20, fontWeight:700, background:"#1a2d50", color:"#8899bb", border:"1px solid #2a3d6a" }}>{p.bowling}</span>}
                      {p.availabilityUncertain && <span style={{ fontSize:13, padding:"3px 10px", borderRadius:20, fontWeight:700, ...UNCERTAIN_BADGE }}>May/May Not Play</span>}
                      {p.manuallyAdded && <span style={{ fontSize:13, padding:"3px 10px", borderRadius:20, fontWeight:700, ...MANUAL_BADGE }}>Manual Entry</span>}
                    </div>
                  </div>

                  {/* Info section */}
                  <div style={{ padding:"12px 18px 16px" }}>
                    <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, color:"#6a80aa", fontSize:14 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="#4a6080"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                        {p.city}{p.state && p.state!=="—" ? `, ${p.state}` : ""}
                      </div>
                      {p.mobile && (
                        <div style={{ display:"flex", alignItems:"center", gap:6, color:"#6a80aa", fontSize:14 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="#4a6080"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
                          {p.mobile}
                        </div>
                      )}
                    </div>
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
                <div style={{ fontSize:11, color:"#3d5070", textTransform:"uppercase", letterSpacing:"2px", fontWeight:700, marginBottom:14 }}>Select Buying Team</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                  {teams.map((t,i) => {
                    const danger = t.purse < rules.defaultBasePrice * Math.max(0, rules.minPlayers - t.players.length);
                    const sel = selTeam === i;
                    return (
                      <button key={t.name} onClick={()=>setSelTeam(i)}
                        style={{ padding:"10px 6px", borderRadius:12, border:`2px solid ${sel?t.color:"#1a2d50"}`,
                          background: sel?`${t.color}11`:"transparent", cursor:"pointer",
                          display:"flex", flexDirection:"column", alignItems:"center", gap:6,
                          transition:"all .15s", boxShadow: sel?`0 0 18px ${t.color}44`:"none" }}>
                        <div style={{ width:44, height:44, borderRadius:"50%",
                          background:`linear-gradient(135deg, ${t.color}22, ${t.color}55)`,
                          border:`2px solid ${sel?t.color:t.color+"66"}`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:15, fontWeight:900, color:t.color, flexShrink:0,
                          boxShadow: sel?`0 0 14px ${t.color}66`:"none" }}>
                          {t.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                        </div>
                        <span style={{ fontSize:12, fontWeight:700, color:sel?t.color:"#6a80aa", textAlign:"center", lineHeight:1.3, wordBreak:"break-word" }}>{t.name}</span>
                        <span style={{ fontSize:12, color:danger?"#ff5f57":"#4a6080", fontWeight:600 }}>{fmt(t.purse)}</span>
                        <span style={{ fontSize:11, color:t.players.length>=rules.minPlayers?"#30d158":"#3d5070", fontWeight:700 }}>{t.players.length}/{rules.minPlayers}</span>
                      </button>
                    );
                  })}
                </div>
                {p && avail && (
                  <div style={{ marginTop:12, background:"#0a1528", border:"1px solid #1a2d50", borderRadius:8, padding:"8px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:13, color:"#4a6080" }}>Max bid for {teams[selTeam].name}</span>
                    <span style={{ fontSize:15, fontWeight:800, color:"#90a4d4" }}>{fmt(calcMax(teams[selTeam], rules.minPlayers, rules.defaultBasePrice))}</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ padding:"16px 18px", display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <button className="cbtn" onClick={lowerBid} disabled={!canLow}
                    style={{ padding:"14px 0", borderRadius:10, border:"1px solid #1a2d50", fontSize:16, fontWeight:800, cursor:"pointer", background:"#0c1830", color:"#90a4d4" }}>
                    − {fmt(rules.bidStep)}
                  </button>
                  <button className="cbtn" onClick={raiseBid} disabled={!avail}
                    style={{ padding:"14px 0", borderRadius:10, border:"1px solid #2a3d6a", fontSize:16, fontWeight:800, cursor:"pointer", background:"#0f1f3a", color:"#90a4d4" }}>
                    + {fmt(rules.bidStep)}
                  </button>
                </div>
                <button className="cbtn" onClick={markSold} disabled={!avail}
                  style={{ padding:"18px 0", borderRadius:10, border:"1px solid #1a4a2a", fontSize:20, fontWeight:900, cursor:"pointer", background:"#0a2818", color:"#30d158", letterSpacing:"2px" }}>
                  ✓ SOLD
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
                  <div key={ri} className="prow" onClick={()=>{ setCur(ri); setOverlay(null); goTo("auction"); }}
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

/* ═══════════════════════════════════════════════════════════════════
   ROOT
═══════════════════════════════════════════════════════════════════ */

export default function App() {
  const [config,  setConfig]  = useState<AuctionConfig|null>(() => rdCfg());
  const [players, setPlayers] = useState<Player[]>([]);
  const [showSetup, setShowSetup] = useState(false);
  const [user, setUser] = useState<string|null>(() => currentUser());

  // Auto-load players on startup if config exists but no saved auction state
  useEffect(() => {
    if (!config) return;
    const manual = rdManual(config.rules.defaultBasePrice);
    const saved  = rdState(config, manual);
    if (saved) { setPlayers(saved.players); return; }
    if (!config.csv.url || !config.csv.columnMap.name) return;
    fetchPlayers(config.csv.url, config.csv.columnMap, config.rules.defaultBasePrice)
      .then(ps => { if (ps.length) setPlayers(mergePlayers(ps, manual)); })
      .catch(console.error);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleLaunch = (cfg: AuctionConfig, ps: Player[]) => {
    setConfig(cfg); setPlayers(ps); setShowSetup(false);
  };

  if (!user) return <Login onLogin={setUser} />;
  if (!config || showSetup) {
    return <SetupWizard existingConfig={config} onLaunch={handleLaunch} user={user} />;
  }
  return (
    <AuctionApp
      config={config}
      initPlayers={players}
      onSetup={() => setShowSetup(true)}
      user={user}
    />
  );
}
