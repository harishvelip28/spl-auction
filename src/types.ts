export type Status = "available" | "sold" | "unsold";

export interface Player {
  serialNo: number; name: string; role: string; batting: string; bowling: string;
  city: string; state: string; mobile: string; basePrice: number; currentBid: number;
  photo: string; availabilityUncertain: boolean; manuallyAdded: boolean;
  status: Status; soldTo?: string; soldPrice?: number;
}
export interface Team { name: string; color: string; purse: number; players: Player[]; }
export interface LeagueConfig { name: string; year: string; logo: string; }
export interface RulesConfig {
  totalPurse: number; minPlayers: number; bidStep: number; defaultBasePrice: number;
  /** Squad size cap; 0 or missing = no cap. */
  maxPlayers?: number;
  /** Bigger raises at higher prices: from this current bid upward, raise by `step`. */
  bidTiers?: BidTier[];
  /** Seconds per "going once" / "going twice" stage before auto-SOLD. */
  callSeconds?: number;
}
export interface BidTier { from: number; step: number; }
export interface TeamDef { name: string; color: string; }
export interface ColumnMap {
  name: string; photo: string; skills: string; address: string;
  mobile: string; availability: string; basePrice: string;
}
export interface AuctionConfig {
  league: LeagueConfig; rules: RulesConfig; teams: TeamDef[];
  csv: { url: string; columnMap: Partial<ColumnMap>; };
}
export interface AuctionState { players: Player[]; teams: Team[]; cur: number; selTeam: number; activity?: ActivityEntry[]; bids?: Bid[]; }

/** One raise on the player currently on auction. `team` is the index into teams. */
export interface Bid { team: number; amount: number; at: number; }

export interface ActivityEntry { playerName: string; teamName: string; teamColor: string; price: number; soldAt: number; }
