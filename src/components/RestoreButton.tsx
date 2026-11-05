import React, { useRef } from "react";
import { restoreBackup } from "../storage";

export function RestoreButton({ style }: { style: React.CSSProperties }) {
  const ref = useRef<HTMLInputElement>(null);
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (!window.confirm("📂 Restore auction from this backup?\n\nThis replaces the auction data currently in this browser.")) return;
    const err = await restoreBackup(f);
    if (err) alert(`Could not restore: ${err}`);
    else window.location.reload();
  };
  return (
    <>
      <button className="cbtn" onClick={() => ref.current?.click()} style={style} title="Load an auction backup file">📂 Restore</button>
      <input ref={ref} type="file" accept="application/json,.json" style={{ display:"none" }} onChange={onFile} />
    </>
  );
}
