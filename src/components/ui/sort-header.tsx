import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface Props {
  label: string;
  sortKey: string;
  currentKey: string | null;
  currentDir: "asc" | "desc";
  onSort: (key: string) => void;
  className?: string;
}

export function SortHeader({ label, sortKey, currentKey, currentDir, onSort, className }: Props) {
  const active = currentKey === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-1 group whitespace-nowrap hover:text-gray-900 transition-colors select-none ${active ? "text-gray-900" : "text-gray-400 hover:text-gray-600"} ${className ?? ""}`}
    >
      <span>{label}</span>
      {active
        ? currentDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        : <ChevronsUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />}
    </button>
  );
}
