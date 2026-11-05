import type { Player, AuctionConfig, AuctionState } from "./types";
import { CONFIG_KEY, STATE_KEY, MANUAL_KEY } from "./constants";
import { normPlayer, mergePlayers } from "./utils";

export const rdCfg = (): AuctionConfig|null => { try { const s=localStorage.getItem(CONFIG_KEY); return s?JSON.parse(s):null; } catch{return null;} };
export const wrCfg = (c: AuctionConfig) => { try { localStorage.setItem(CONFIG_KEY,JSON.stringify(c)); } catch{} };

export function rdState(cfg: AuctionConfig, manual: Player[]): AuctionState|null {
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
      activity: Array.isArray(st.activity) ? st.activity : [],
    };
  } catch { return null; }
}
/** Returns false when the save failed (usually browser storage is full), so the UI can warn. */
export const wrState = (s: AuctionState): boolean => { try { if(s.players.length) localStorage.setItem(STATE_KEY,JSON.stringify(s)); else localStorage.removeItem(STATE_KEY); return true; } catch { return false; } };
export const clrState = () => { try { localStorage.removeItem(STATE_KEY); } catch{} };
export function rdManual(mb: number): Player[] {
  try { const s=localStorage.getItem(MANUAL_KEY); return s?(JSON.parse(s) as Partial<Player>[]).map((p,i)=>normPlayer({...p,manuallyAdded:true},i+1,mb)):[];} catch{return[];}
}
export const wrManual = (ps: Player[]) => { try { if(ps.length) localStorage.setItem(MANUAL_KEY,JSON.stringify(ps)); else localStorage.removeItem(MANUAL_KEY); } catch{} };

/* Backup file: everything needed to resume the auction on any machine/browser. */
const BACKUP_KIND = "spl-auction-backup";
export function downloadBackup(config: AuctionConfig, state: AuctionState, manual: Player[]) {
  const data = { kind: BACKUP_KIND, version: 1, savedAt: new Date().toISOString(), config, state, manual };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${config.league.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-auction-backup-${stamp}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Writes a backup file into browser storage. Returns an error message, or null on success. */
export async function restoreBackup(file: File): Promise<string | null> {
  let data: { kind?: string; config?: AuctionConfig; state?: AuctionState; manual?: Player[] };
  try { data = JSON.parse(await file.text()); } catch { return "This file is not valid JSON."; }
  if (data?.kind !== BACKUP_KIND || !data.config?.rules || !Array.isArray(data.state?.players)) return "This is not an auction backup file.";
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(data.config));
    localStorage.setItem(STATE_KEY, JSON.stringify(data.state));
    if (data.manual?.length) localStorage.setItem(MANUAL_KEY, JSON.stringify(data.manual)); else localStorage.removeItem(MANUAL_KEY);
  } catch { return "Browser storage is full or blocked."; }
  return null;
}
