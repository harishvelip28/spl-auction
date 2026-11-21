import { useState, type CSSProperties } from "react";
import { teamInitials } from "../logo";

/** Round team badge: the team logo when there is one, otherwise the team's initials in its colour. */
export function TeamAvatar({ team, size, border = 2, style }: {
  team: { name: string; color: string; logo?: string };
  size: number;
  border?: number;
  style?: CSSProperties;
}) {
  // Remember which logo failed so a newly uploaded one gets a fresh try.
  const [broken, setBroken] = useState<string | null>(null);
  const logo = team.logo && team.logo !== broken ? team.logo : "";
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden",
      background: logo ? "#f4f6fb" : `${team.color}33`, border:`${border}px solid ${team.color}`, color:team.color, fontWeight:900,
      fontSize:Math.round(size * 0.37), ...style }}>
      {logo
        ? <img src={logo} alt="" style={{ width:"86%", height:"86%", objectFit:"contain" }} onError={() => setBroken(logo)} />
        : teamInitials(team.name)}
    </div>
  );
}
