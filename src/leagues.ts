/* ═══════════════════════════════════════════════════════════════════
   LEAGUES — each league keeps its own setup, auction, players and
   live-share link in this browser. After login the operator picks one;
   the choice is remembered until they press "Switch league".

   To add a league, add an entry below with a new short id.
   csv = the published CSV link of its registration responses sheet
   (used as the starting sheet in Setup step 4).
   SPL keeps the original storage keys, so data saved before leagues
   existed stays with SPL.
═══════════════════════════════════════════════════════════════════ */

export interface League { id: string; name: string; csv: string; }

export const LEAGUES: League[] = [
  { id: "spl", name: "Shigao Premier League",
    csv: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVKm1zcwXbaj8Ui3jQl_1fJPU-4ZN3G9V1Dd2vRX6rWdAlkInpTHj5VMrLVjjIsvVlD4SkPal7V3Xc/pub?gid=98031908&single=true&output=csv" },
  { id: "dcl", name: "Dharbandora Cricket League",
    csv: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRPXmpBjP4mIbDFNnVS3L40uTAjiiVFfrYtwC1JOIS3Qv_aElJJT3vrYSOih-nOlAni4ehrSXYO4N7w/pub?gid=1532922794&single=true&output=csv" },
];

/** Shared by every window in this browser, so the projector follows the console's league. */
export const ACTIVE_LEAGUE_KEY = "auction-active-league-v1";

export function activeLeague(): League | null {
  try { const id = localStorage.getItem(ACTIVE_LEAGUE_KEY); return LEAGUES.find(l => l.id === id) ?? null; } catch { return null; }
}
export function setActiveLeague(id: string | null) {
  try { if (id) localStorage.setItem(ACTIVE_LEAGUE_KEY, id); else localStorage.removeItem(ACTIVE_LEAGUE_KEY); } catch { /* choice lasts this page only */ }
}

/** Storage key for the active league: SPL uses the plain key, other leagues add "@<id>". */
export function leagueKey(base: string): string {
  const id = activeLeague()?.id ?? "spl";
  return id === "spl" ? base : `${base}@${id}`;
}
