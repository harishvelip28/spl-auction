import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Team } from "./types";
import { fmt } from "./utils";

const escHtml = (v: string|number|undefined|null) =>
  String(v ?? "—").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

/** HTML section for one team, using inline styles Word understands. */
function buildTeamHtml(team: Team, totalPurse: number) {
  const spent = totalPurse - team.purse;
  const avg = team.players.length ? Math.round(spent / team.players.length) : 0;
  const th = `style="border:1px solid #444;background:#1a2d50;color:#ffffff;padding:6px 8px;font-weight:bold;text-align:center;"`;
  const td = `style="border:1px solid #444;padding:6px 8px;text-align:center;"`;
  const tdL = `style="border:1px solid #444;padding:6px 8px;text-align:left;"`;
  const rows = team.players.length
    ? team.players.map((pl, i) => {
        const tags = pl.manuallyAdded ? "Manual Entry" : "";
        const loc = `${pl.city || ""}${pl.state && pl.state !== "—" ? `, ${pl.state}` : ""}` || "—";
        return `<tr>
          <td ${td}>${i + 1}</td>
          <td ${tdL}><b>${escHtml(pl.name)}</b>${tags ? ` <i style="color:#a05a00;">(${escHtml(tags)})</i>` : ""}</td>
          <td ${td}>${escHtml(pl.role)}</td>
          <td ${td}>${escHtml(loc)}</td>
          <td ${td}>${escHtml(pl.mobile || "—")}</td>
          <td ${td}><b>${escHtml(fmt(pl.soldPrice ?? pl.currentBid))}</b></td>
        </tr>`;
      }).join("")
    : `<tr><td ${td} colspan="6">No players bought yet</td></tr>`;
  return `
    <h2 style="color:${escHtml(team.color)};font-family:Calibri,Arial,sans-serif;margin:0 0 8px;">${escHtml(team.name)}</h2>
    <table style="border-collapse:collapse;margin-bottom:12px;font-family:Calibri,Arial,sans-serif;font-size:11pt;">
      <tr><th ${th}>Players</th><th ${th}>Purse Spent</th><th ${th}>Purse Left</th><th ${th}>Avg Bid</th></tr>
      <tr><td ${td}>${team.players.length}</td><td ${td}>${escHtml(fmt(spent))}</td><td ${td}>${escHtml(fmt(team.purse))}</td><td ${td}>${team.players.length ? escHtml(fmt(avg)) : "—"}</td></tr>
    </table>
    <table style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt;">
      <tr><th ${th}>#</th><th ${th}>Player</th><th ${th}>Role</th><th ${th}>City / State</th><th ${th}>Mobile</th><th ${th}>Bid Price</th></tr>
      ${rows}
    </table>`;
}

/** Word-compatible .doc (HTML with Office namespaces) containing one or more teams. */
export function buildTeamsDoc(title: string, teamList: Team[], totalPurse: number): Blob {
  const sections = teamList.map((t, i) =>
    `${i > 0 ? `<br style="page-break-before:always;mso-break-type:page-break;" clear="all">` : ""}${buildTeamHtml(t, totalPurse)}`
  ).join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escHtml(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>@page { size: A4; margin: 1.5cm; } body { font-family: Calibri, Arial, sans-serif; }</style>
</head><body>
<h1 style="font-family:Calibri,Arial,sans-serif;color:#1a2d50;margin:0 0 4px;">${escHtml(title)}</h1>
<p style="color:#666;margin:0 0 14px;">Generated ${escHtml(new Date().toLocaleString("en-IN"))}</p>
${sections}
</body></html>`;
  return new Blob(["﻿", html], { type: "application/msword" });
}

/** PDF with summary + players table per team (one team per page). Uses "Rs." since built-in PDF fonts lack the ₹ glyph. */
export function buildTeamsPdf(title: string, teamList: Team[], totalPurse: number): Blob {
  const money = (n: number) => "Rs. " + Number(n).toLocaleString("en-IN");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 40;
  const lastY = () => (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 0;
  const generated = `Generated ${new Date().toLocaleString("en-IN")}`;

  teamList.forEach((team, idx) => {
    if (idx > 0) doc.addPage();
    let y = 48;
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor("#1a2d50");
    doc.text(title, marginX, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor("#666666");
    doc.text(generated, marginX, y += 14);
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(team.color || "#1a2d50");
    doc.text(team.name, marginX, y += 28);

    const spent = totalPurse - team.purse;
    const avg = team.players.length ? Math.round(spent / team.players.length) : 0;
    const head = { fillColor: "#1a2d50", textColor: "#ffffff", fontStyle: "bold" as const, halign: "center" as const };
    autoTable(doc, {
      startY: y + 10, margin: { left: marginX, right: marginX }, theme: "grid",
      headStyles: head, styles: { halign: "center", fontSize: 10 },
      head: [["Players", "Purse Spent", "Purse Left", "Avg Bid"]],
      body: [[String(team.players.length), money(spent), money(team.purse), team.players.length ? money(avg) : "-"]],
    });

    const body = team.players.length
      ? team.players.map((pl, i) => {
          const loc = `${pl.city || ""}${pl.state && pl.state !== "—" ? `, ${pl.state}` : ""}` || "-";
          return [String(i + 1), pl.manuallyAdded ? `${pl.name}\n(Manual Entry)` : pl.name, pl.role || "-", loc, pl.mobile || "-", money(pl.soldPrice ?? pl.currentBid)];
        })
      : [[{ content: "No players bought yet", colSpan: 6 }]];
    autoTable(doc, {
      startY: lastY() + 14, margin: { left: marginX, right: marginX }, theme: "grid",
      headStyles: head, styles: { halign: "center", valign: "middle", fontSize: 10, cellPadding: 5 },
      alternateRowStyles: { fillColor: "#f2f5fa" },
      columnStyles: { 0: { cellWidth: 26 }, 1: { halign: "left", fontStyle: "bold" }, 5: { fontStyle: "bold" } },
      head: [["#", "Player", "Role", "City / State", "Mobile", "Bid Price"]],
      body,
    });
  });
  return doc.output("blob");
}

export const safeFileName =(s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "team";
