import { useState, useEffect } from "react";
import Login from "./Login";
import Downloads from "./Downloads";
import { currentUser } from "./auth";
import type { Player, AuctionConfig } from "./types";
import { mergePlayers, fetchPlayers } from "./utils";
import { rdCfg, rdState, rdManual } from "./storage";
import { SetupWizard } from "./wizard/SetupWizard";
import { AuctionApp } from "./AuctionApp";

export default function App() {
  const [config,  setConfig]  = useState<AuctionConfig|null>(() => rdCfg());
  const [players, setPlayers] = useState<Player[]>([]);
  const [showSetup, setShowSetup] = useState(false);
  const [user, setUser] = useState<string|null>(() => currentUser());

  // Public downloads page at /#downloads — reachable without logging in.
  const [showDownloads, setShowDownloads] = useState(() => window.location.hash === "#downloads");
  useEffect(() => {
    const onHash = () => setShowDownloads(window.location.hash === "#downloads");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const leaveDownloads = () => {
    history.pushState(null, "", window.location.pathname + window.location.search);
    setShowDownloads(false);
  };

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

  if (showDownloads) return <Downloads onBack={leaveDownloads} />;
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
