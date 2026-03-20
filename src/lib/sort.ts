export function sortItems<T>(
  data: T[],
  key: string | null,
  dir: "asc" | "desc",
  getVal: (item: T, key: string) => unknown = (item, k) => (item as Record<string, unknown>)[k]
): T[] {
  if (!key) return data;
  return [...data].sort((a, b) => {
    const av = getVal(a, key);
    const bv = getVal(b, key);
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    if (typeof av === "string" && typeof bv === "string")
      return dir === "asc" ? av.localeCompare(bv, "de") : bv.localeCompare(av, "de");
    if (typeof av === "number" && typeof bv === "number")
      return dir === "asc" ? av - bv : bv - av;
    if (av instanceof Date && bv instanceof Date)
      return dir === "asc" ? av.getTime() - bv.getTime() : bv.getTime() - av.getTime();
    const as = String(av); const bs = String(bv);
    return dir === "asc" ? as.localeCompare(bs, "de") : bs.localeCompare(as, "de");
  });
}
