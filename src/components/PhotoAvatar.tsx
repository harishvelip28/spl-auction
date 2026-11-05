import React, { useState } from "react";
import { getInitials, driveUrls } from "../utils";

export function PhotoAvatar({ photo, name, card, size }: { photo:string; name:string; card?:boolean; size?:number }) {
  const urls = driveUrls(photo);
  // Track which fallback URL we're on *per photo*: the auction card reuses this component across
  // players, so without resetting, one player's failed photo would hide every later player's photo.
  const [fb, setFb] = useState({ photo, idx: 0 });
  if (fb.photo !== photo) setFb({ photo, idx: 0 });
  const idx = fb.photo === photo ? fb.idx : 0;
  const setIdx = (f: (i: number) => number) => setFb(s => ({ photo, idx: f(s.photo === photo ? s.idx : 0) }));
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
