import React from "react";
import { WIZ_STEPS } from "./styles";

export function StepBar({ step }: { step: number }) {
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
