/* Live events from the operator console to the projector display window (same browser).
   Auction state itself syncs through localStorage; this only carries the one-off animations. */
export type DisplayEvent =
  | { type: "sold"; player: string; team: string; color: string; price: number }
  | { type: "unsold"; player: string }
  | { type: "reauction" }
  | { type: "going"; stage: 0 | 1 | 2 };

const NAME = "spl-auction-display";

export function sendDisplay(e: DisplayEvent) {
  try { const c = new BroadcastChannel(NAME); c.postMessage(e); c.close(); } catch { /* no display support */ }
}

export function onDisplay(fn: (e: DisplayEvent) => void): () => void {
  try {
    const c = new BroadcastChannel(NAME);
    c.onmessage = m => fn(m.data as DisplayEvent);
    return () => c.close();
  } catch { return () => {}; }
}
