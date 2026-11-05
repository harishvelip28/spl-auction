import { useState, useEffect } from "react";
import type { Player, ColumnMap, AuctionConfig } from "../types";
import { COL_CONCEPTS } from "../constants";
import { autoMap, fetchHeaders, headersFromText, parseCSVText, fetchPlayers } from "../utils";
import { wizInp, wizLbl } from "./styles";
import { GoogleFormGuide } from "./GoogleFormGuide";

/* Step 4: Players / CSV */
export function Step4Players({ cfg, onChange, onPlayers }: {
  cfg: AuctionConfig;
  onChange:(c:AuctionConfig)=>void;
  onPlayers:(ps:Player[])=>void;
}) {
  const [source,  setSource]  = useState<"url"|"file">("url");
  const [url,     setUrl]     = useState(cfg.csv.url);
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [headers,   setHeaders]   = useState<string[]>([]);
  const [colMap,    setColMap]    = useState<Partial<ColumnMap>>(cfg.csv.columnMap);
  const [status,    setStatus]    = useState<"idle"|"detecting"|"ready"|"loading"|"done"|"error">("idle");
  const [playerCount, setPlayerCount] = useState(0);
  const [errMsg,    setErrMsg]    = useState("");

  const resetHeaders = () => { setHeaders([]); setStatus("idle"); setErrMsg(""); };
  const applyHeaders = (h: string[]) => {
    if (!h.length) { setErrMsg("No column headers found in this file."); setStatus("error"); return; }
    setHeaders(h);
    setColMap({ ...autoMap(h), ...cfg.csv.columnMap });
    setStatus("ready");
  };

  // ── URL source ──────────────────────────────────────────────────────────────
  const detectFromUrl = async (targetUrl = url) => {
    if (!targetUrl.trim()) { alert("Paste a CSV URL first."); return; }
    setStatus("detecting"); setErrMsg("");
    try { applyHeaders(await fetchHeaders(targetUrl.trim())); }
    catch (e: unknown) { setErrMsg(e instanceof Error ? e.message : "Could not reach URL."); setStatus("error"); }
  };

  // Auto-detect headers on mount if a URL is already set (e.g. wizard re-opened)
  useEffect(() => {
    if (url.trim() && status === "idle") detectFromUrl(url);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── File source ─────────────────────────────────────────────────────────────
  const readFile = (file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv" && !file.type.includes("spreadsheet")) {
      setErrMsg("Please choose a .csv file."); setStatus("error"); return;
    }
    setFileName(file.name); setStatus("detecting"); setErrMsg("");
    const rd = new FileReader();
    rd.onload = ev => {
      const text = ev.target?.result as string;
      setRawText(text);
      applyHeaders(headersFromText(text));
    };
    rd.onerror = () => { setErrMsg("Failed to read file."); setStatus("error"); };
    rd.readAsText(file);
  };

  // ── Load players ────────────────────────────────────────────────────────────
  const loadPlayers = async () => {
    setStatus("loading");
    try {
      let ps: Player[];
      if (source === "url") {
        onChange({ ...cfg, csv: { url: url.trim(), columnMap: colMap } });
        ps = await fetchPlayers(url.trim(), colMap, cfg.rules.defaultBasePrice);
      } else {
        onChange({ ...cfg, csv: { url: "", columnMap: colMap } });
        ps = parseCSVText(rawText, colMap, cfg.rules.defaultBasePrice);
      }
      if (!ps.length) throw new Error("No players found. Check column mapping.");
      setPlayerCount(ps.length);
      onPlayers(ps);
      setStatus("done");
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : "Failed to parse players.");
      setStatus("error");
    }
  };

  const setMap = (key: keyof ColumnMap, val: string) => setColMap(m => ({ ...m, [key]: val }));

  const switchSource = (s: "url"|"file") => { setSource(s); resetHeaders(); setRawText(""); setFileName(""); };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      <GoogleFormGuide defaultOpen={!cfg.csv.url} />

      {/* Source selector */}
      <div style={{ display:"flex", border:"1px solid #1a2d50", borderRadius:10, overflow:"hidden" }}>
        {([
          { key:"url",  label:"🔗 Google Forms / Sheets URL" },
          { key:"file", label:"📁 Upload CSV from device" },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={()=>switchSource(key)}
            style={{ flex:1, padding:"12px 0", border:"none", cursor:"pointer", fontSize:14, fontWeight:700,
              background: source===key?"#1a2d50":"transparent",
              color: source===key?"#90a4d4":"#4a6080",
              borderRight: key==="url"?"1px solid #1a2d50":"none" }}>
            {label}
          </button>
        ))}
      </div>

      {/* URL panel */}
      {source === "url" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <label style={wizLbl}>Published CSV URL</label>
          <div style={{ display:"flex", gap:8 }}>
            <input style={{ ...wizInp, flex:1 }} value={url} placeholder="Paste Google Sheets CSV link…"
              onChange={e=>{ setUrl(e.target.value); resetHeaders(); }} />
            <button onClick={()=>detectFromUrl()} disabled={status==="detecting"}
              style={{ padding:"10px 18px", border:"none", borderRadius:8, fontSize:15, fontWeight:700, cursor:"pointer",
                background: status==="detecting"?"#1a2d50":"#1e3a6e", color:"#90a4d4" }}>
              {status==="detecting" ? "…" : "Detect"}
            </button>
          </div>
          <div style={{ fontSize:12, color:"#3d5070", lineHeight:1.6 }}>
            In Google Sheets: <b style={{ color:"#6a80aa" }}>File → Share → Publish to web → CSV → Copy link</b>
          </div>
        </div>
      )}

      {/* File upload panel */}
      {source === "file" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <label style={wizLbl}>CSV File</label>
          <label
            onDragOver={e=>{ e.preventDefault(); setIsDragging(true); }}
            onDragLeave={()=>setIsDragging(false)}
            onDrop={e=>{ e.preventDefault(); setIsDragging(false); const f=e.dataTransfer.files?.[0]; if(f) readFile(f); }}
            style={{ display:"block", cursor:"pointer" }}>
            <div style={{
              border: `2px dashed ${isDragging?"#f0c040":"#1a2d50"}`,
              borderRadius:10, padding:"28px 20px", textAlign:"center",
              background: isDragging?"#0e1e10":"#07101e", transition:"all .15s",
            }}>
              {fileName ? (
                <div>
                  <div style={{ fontSize:22, marginBottom:6 }}>📄</div>
                  <div style={{ fontSize:15, color:"#90a4d4", fontWeight:700 }}>{fileName}</div>
                  <div style={{ fontSize:13, color:"#4a6080", marginTop:4 }}>Click to choose a different file</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize:28, marginBottom:8 }}>📂</div>
                  <div style={{ fontSize:15, color:"#6a80aa", fontWeight:600 }}>Drop a CSV file here</div>
                  <div style={{ fontSize:13, color:"#3d5070", marginTop:4 }}>or click to browse</div>
                </div>
              )}
            </div>
            <input type="file" accept=".csv,text/csv" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(f) readFile(f); }} />
          </label>
          <div style={{ fontSize:12, color:"#3d5070", lineHeight:1.6 }}>
            Export your Google Sheet as <b style={{ color:"#6a80aa" }}>File → Download → CSV (.csv)</b> then upload here.
          </div>
        </div>
      )}

      {/* Error */}
      {status==="error" && <div style={{ color:"#ff5f57", fontSize:14, background:"#1a0808", border:"1px solid #3a1010", borderRadius:8, padding:"10px 14px" }}>{errMsg}</div>}

      {/* Column mapping (shared for both sources) */}
      {headers.length > 0 && (
        <div>
          <label style={{ ...wizLbl, marginBottom:10 }}>Column Mapping</label>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {COL_CONCEPTS.map(({ key, label, required }) => (
              <div key={key} style={{ display:"grid", gridTemplateColumns:"140px 1fr", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:14, color:required?"#f0c040":"#8899bb", fontWeight:600 }}>
                  {label}{required && " *"}
                </span>
                <select value={colMap[key]||""} onChange={e=>setMap(key,e.target.value)}
                  style={{ ...wizInp, padding:"7px 10px", fontSize:14, cursor:"pointer" }}>
                  <option value="">(none)</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button onClick={loadPlayers} disabled={!colMap.name || status==="loading"}
            style={{ marginTop:16, padding:"11px 22px", border:"none", borderRadius:8, fontSize:15, fontWeight:700,
              cursor: colMap.name?"pointer":"not-allowed",
              background: colMap.name?"#1a4a2a":"#111f3a", color: colMap.name?"#4caf50":"#4a6080" }}>
            {status==="loading" ? "Loading players…" : "Load & Preview Players"}
          </button>
          {status==="done" && (
            <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:8, color:"#30d158", fontSize:15, fontWeight:700 }}>
              <span>✓</span> {playerCount} players loaded successfully
            </div>
          )}
        </div>
      )}
    </div>
  );
}
