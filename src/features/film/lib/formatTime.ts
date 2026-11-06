/** "2:05" */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/** "2 minutes 5 seconds", for aria-valuetext. */
export function formatTimeVerbose(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0 seconds";
  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const parts: string[] = [];
  if (mins > 0) parts.push(`${mins} minute${mins === 1 ? "" : "s"}`);
  parts.push(`${secs} second${secs === 1 ? "" : "s"}`);
  return parts.join(" ");
}
