import type React from "react";
import type { TeamDef, ColumnMap, AuctionConfig } from "./types";

export const CONFIG_KEY = "auction-config-v2";
export const STATE_KEY  = "auction-state-v2";
export const MANUAL_KEY = "auction-manual-v2";

const DEFAULT_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVKm1zcwXbaj8Ui3jQl_1fJPU-4ZN3G9V1Dd2vRX6rWdAlkInpTHj5VMrLVjjIsvVlD4SkPal7V3Xc/pub?gid=98031908&single=true&output=csv";

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
