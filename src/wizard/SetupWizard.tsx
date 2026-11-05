import { useState } from "react";
import type { Player, AuctionConfig } from "../types";
import { DEFAULT_CONFIG } from "../constants";
import { wrCfg, clrState } from "../storage";
import { RestoreButton } from "../components/RestoreButton";
import { UserBadge } from "../components/UserBadge";
import { StepBar } from "./StepBar";
import { Step1League } from "./Step1League";
import { Step2Teams } from "./Step2Teams";
import { Step3Rules } from "./Step3Rules";
import { Step4Players } from "./Step4Players";
import { Step5Review } from "./Step5Review";

/* Setup Wizard orchestrator */
export function SetupWizard({ existingConfig, onLaunch, user }: {
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
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <RestoreButton style={{ padding:"8px 14px", border:"1px solid #1a2d50", borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:700, background:"#0a1528", color:"#6a80aa" }} />
            <UserBadge user={user} />
          </div>
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
