import React, { useState } from "react";
import { hasUsers, login } from "./auth";

const lbl: React.CSSProperties = { display:"block", fontSize:12, fontWeight:700, color:"#6a80aa", letterSpacing:".5px", textTransform:"uppercase", marginBottom:6, textAlign:"left" };
const inp: React.CSSProperties = { width:"100%", padding:"12px 14px", marginBottom:18, fontSize:16, color:"#fff", background:"#0a1528", border:"1px solid #1a2d50", borderRadius:8, outline:"none" };

export default function Login({ onLogin }: { onLogin: (user: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(hasUsers() ? "" : "No members configured. Set VITE_AUCTION_USERS and rebuild.");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError("Enter username and password"); return; }
    const user = login(username, password);
    if (user) onLogin(user);
    else { setError("Invalid username or password"); setPassword(""); }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:16,
      background:"radial-gradient(ellipse at top, #0c1a33 0%, #030710 60%)", color:"#fff",
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <style>{`.login-inp:focus{ border-color:#f0c040!important; } *{ box-sizing:border-box; }`}</style>
      <form onSubmit={submit} autoComplete="on"
        style={{ width:"100%", maxWidth:400, background:"#07101e", border:"1px solid #1a2d50", borderRadius:16, padding:"36px 30px 30px", boxShadow:"0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ width:56, height:56, margin:"0 auto 16px", borderRadius:12, background:"#f0c040", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>🏏</div>
        <div style={{ textAlign:"center", fontSize:22, fontWeight:800, color:"#f0c040", letterSpacing:".3px" }}>Player Auction</div>
        <div style={{ textAlign:"center", fontSize:12, color:"#4a6080", letterSpacing:"1.5px", textTransform:"uppercase", margin:"6px 0 28px" }}>Members only</div>

        {error && (
          <div role="alert" style={{ marginBottom:16, padding:"10px 12px", fontSize:14, borderRadius:8, background:"#1e0808", border:"1px solid #5a1010", color:"#ff5f57", textAlign:"left" }}>
            {error}
          </div>
        )}

        <label htmlFor="username" style={lbl}>Username</label>
        <input id="username" className="login-inp" style={inp} autoComplete="username" autoFocus
          value={username} onChange={e=>setUsername(e.target.value)} />

        <label htmlFor="password" style={lbl}>Password</label>
        <input id="password" className="login-inp" style={inp} type="password" autoComplete="current-password"
          value={password} onChange={e=>setPassword(e.target.value)} />

        <button type="submit"
          style={{ width:"100%", padding:13, marginTop:4, fontSize:16, fontWeight:800, cursor:"pointer", background:"#f0c040", color:"#050a14", border:"none", borderRadius:8 }}>
          Login
        </button>
        <div style={{ textAlign:"center", fontSize:12, color:"#3d5070", marginTop:22 }}>Ask the auction organiser for access.</div>
      </form>
    </div>
  );
}
