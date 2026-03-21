export function calcNettoStunden(
  startTime: string | null,
  endTime: string | null,
  pauseMinutes: number
): number | null {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const totalMinutes = eh * 60 + em - (sh * 60 + sm) - pauseMinutes;
  return Math.max(0, totalMinutes / 60);
}
