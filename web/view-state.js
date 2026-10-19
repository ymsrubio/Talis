// Derives what the Parent page shows from what it has loaded so far.

// loading: first load not finished. no-riders: nobody is registered.
// start-of-day: Riders exist but nobody has a Tap today. normal: otherwise.
export function viewState({ loaded, riderCount, boardedCount }) {
  if (!loaded) return "loading";
  if (riderCount === 0) return "no-riders";
  if (boardedCount === 0) return "start-of-day";
  return "normal";
}

// "offline" means we cannot vouch for what is on screen: the browser is
// offline or the realtime channel is not subscribed after it was lost.
export function connectionState({ channel, online }) {
  if (!online) return "offline";
  if (channel === "subscribed") return "live";
  return channel === "error" ? "offline" : "connecting";
}
