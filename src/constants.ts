import type React from "react";
import type { TeamDef, ColumnMap, AuctionConfig } from "./types";
import { leagueKey, LEAGUES, type League } from "./leagues";

/* Storage keys are per league (see leagues.ts), so they are functions. */
export const CONFIG_KEY = () => leagueKey("auction-config-v2");
export const STATE_KEY  = () => leagueKey("auction-state-v2");
export const MANUAL_KEY = () => leagueKey("auction-manual-v2");
/** "1" while the console has put the auction summary on the projector. */
export const SUMMARY_KEY = () => leagueKey("auction-display-summary-v1");
/** "1" while the console has the cycling team-squad view on the projector. */
export const TEAMS_KEY = () => leagueKey("auction-display-teams-v1");

const DEFAULT_CSV = LEAGUES[0].csv;

const DEFAULT_TEAMS: TeamDef[] = [
  { name: "Ajoba Warrior's",    color: "#e53935" },
  { name: "Parthvik Jaguar's",  color: "#fb8c00" },
  { name: "Shrisha Striker's",  color: "#43a047" },
  { name: "Shrisha Warrior's",  color: "#1e88e5" },
  { name: "Mandev Cricketer's", color: "#8e24aa" },
  { name: "MSC Warrior's",      color: "#00acc1" },
];

export const DEFAULT_CONFIG: AuctionConfig = {
  league: { name: "Shigao Premier League", year: "2027", logo: "" },
  rules:  { totalPurse: 10000, minPlayers: 12, bidStep: 100, defaultBasePrice: 300 },
  teams:  DEFAULT_TEAMS,
  csv:    { url: DEFAULT_CSV, columnMap: {} },
};

/** Starting setup for a league: SPL gets its teams; other leagues start with placeholder
    teams to rename during setup. Each league starts with its own sheet from leagues.ts. */
export const defaultConfig = (league: League | null): AuctionConfig =>
  !league || league.id === "spl" ? DEFAULT_CONFIG : {
    ...DEFAULT_CONFIG,
    league: { ...DEFAULT_CONFIG.league, name: league.name },
    teams: [1, 2, 3, 4].map(n => ({ name: `Team ${n}`, color: PRESET_COLORS[n - 1] })),
    csv: { url: league.csv, columnMap: {} },
  };

export const PRESET_COLORS = [
  "#e53935","#fb8c00","#fdd835","#43a047",
  "#00acc1","#1e88e5","#3949ab","#8e24aa",
  "#f06292","#ff7043","#26a69a","#78909c",
];

export const COL_CONCEPTS: { key: keyof ColumnMap; label: string; required: boolean }[] = [
  { key: "name",         label: "Player Name",  required: true  },
  { key: "photo",        label: "Photo URL",     required: false },
  { key: "skills",       label: "Skills / Role", required: false },
  { key: "address",      label: "City, State",   required: false },
  { key: "mobile",       label: "Mobile",        required: false },
  { key: "availability", label: "Availability",  required: false },
  { key: "basePrice",    label: "Base Price",    required: false },
];

export const ROLE_STYLE: Record<string, React.CSSProperties> = {
  Batsman:         { background: "#0d2b0d", color: "#4caf50", border: "1px solid #1a5c1a" },
  Bowler:          { background: "#0d1a3a", color: "#7986cb", border: "1px solid #1a2d6b" },
  "All-Rounder":   { background: "#2b1f00", color: "#f0c040", border: "1px solid #5c4400" },
  "Wicket Keeper": { background: "#2b1000", color: "#ff9800", border: "1px solid #5c3000" },
};
export const UNCERTAIN_BADGE: React.CSSProperties = { background: "#2b240d", color: "#f3cc6b", border: "1px solid #7a5d1f" };
export const MANUAL_BADGE: React.CSSProperties    = { background: "#102b28", color: "#78d6c8", border: "1px solid #1f6a61" };
