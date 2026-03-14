"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, MessageSquare, FileText, ClipboardList, Truck, CheckSquare, HardHat, FolderOpen, X, Construction } from "lucide-react";

interface SearchResults {
  contacts?: { id: string; companyName: string; contactPerson?: string | null; type: string }[];
  requests?: { id: string; title: string; status: string; contact: { companyName: string } }[];
  quotes?: { id: string; title: string; quoteNumber: string; status: string; contact: { companyName: string } }[];
  orders?: { id: string; title: string; orderNumber: string; status: string; contact: { companyName: string } }[];
  deliveryNotes?: { id: string; deliveryNumber: string; material: string; contact: { companyName: string } }[];
  tasks?: { id: string; title: string; status: string; priority: string }[];
  resources?: { id: string; name: string; type: string }[];
  attachments?: { id: string; fileName: string; contact?: { companyName: string } | null }[];
  baustellen?: { id: string; name: string; status: string; city?: string | null; order: { orderNumber: string } }[];
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

const SECTIONS = [
  { key: "contacts", label: "Kontakte", icon: Users, href: (id: string) => `/kontakte/${id}`, display: (r: { companyName: string; contactPerson?: string | null }) => ({ title: r.companyName, sub: r.contactPerson ?? undefined }) },
  { key: "requests", label: "Anfragen", icon: MessageSquare, href: (id: string) => `/anfragen/${id}`, display: (r: { title: string; contact: { companyName: string } }) => ({ title: r.title, sub: r.contact.companyName }) },
  { key: "quotes", label: "Angebote", icon: FileText, href: (id: string) => `/angebote/${id}`, display: (r: { quoteNumber: string; title: string; contact: { companyName: string } }) => ({ title: `${r.quoteNumber} – ${r.title}`, sub: r.contact.companyName }) },
  { key: "orders", label: "Aufträge", icon: ClipboardList, href: (id: string) => `/auftraege/${id}`, display: (r: { orderNumber: string; title: string; contact: { companyName: string } }) => ({ title: `${r.orderNumber} – ${r.title}`, sub: r.contact.companyName }) },
  { key: "deliveryNotes", label: "Lieferscheine", icon: Truck, href: () => `/dokumente`, display: (r: { deliveryNumber: string; material: string; contact: { companyName: string } }) => ({ title: r.deliveryNumber, sub: `${r.material} · ${r.contact.companyName}` }) },
  { key: "tasks", label: "Aufgaben", icon: CheckSquare, href: () => `/aufgaben`, display: (r: { title: string }) => ({ title: r.title }) },
  { key: "resources", label: "Ressourcen", icon: HardHat, href: () => `/ressourcen`, display: (r: { name: string; type: string }) => ({ title: r.name, sub: r.type }) },
  { key: "attachments", label: "Anhänge", icon: FolderOpen, href: () => `/dokumente`, display: (r: { fileName: string; contact?: { companyName: string } | null }) => ({ title: r.fileName, sub: r.contact?.companyName }) },
  { key: "baustellen", label: "Baustellen", icon: Construction, href: (id: string) => `/baustellen/${id}`, display: (r: { name: string; city?: string | null; order: { orderNumber: string } }) => ({ title: r.name, sub: [r.order.orderNumber, r.city].filter(Boolean).join(" · ") }) },
] as const;

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({});
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults({});
    }
  }, [open]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query || query.length < 2) { setResults({}); setLoading(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results ?? {});
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  function navigate(href: string) {
    router.push(href);
    onClose();
  }

  const hasResults = SECTIONS.some((s) => (results[s.key as keyof SearchResults] ?? []).length > 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden" onKeyDown={handleKeyDown}>
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suche in Kontakte, Anfragen, Angebote…"
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-gray-300 hover:text-gray-500">
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-400 border border-gray-200">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Suche…</div>
          )}

          {!loading && query.length >= 2 && !hasResults && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Keine Ergebnisse für „{query}"</div>
          )}

          {!loading && !query && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">Tippe mindestens 2 Zeichen zum Suchen</div>
          )}

          {!loading && hasResults && (
            <div className="py-2">
              {SECTIONS.map((section) => {
                const items = (results[section.key as keyof SearchResults] ?? []) as { id: string; [key: string]: unknown }[];
                if (!items.length) return null;
                const Icon = section.icon;
                return (
                  <div key={section.key}>
                    <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                      <Icon className="h-3.5 w-3.5 text-gray-400" />
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{section.label}</p>
                    </div>
                    {items.map((item) => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const { title, sub } = (section.display as (r: any) => { title: string; sub?: string })(item);
                      const href = (section.href as (id: string) => string)(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => navigate(href)}
                          className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
                            {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function useGlobalSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return { open, setOpen };
}
