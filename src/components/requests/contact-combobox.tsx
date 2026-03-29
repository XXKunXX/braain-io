"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Contact } from "@prisma/client";

// German phonetic normalization
function phonetize(str: string): string {
  return str
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/ph/g, "f")
    .replace(/th/g, "t")
    .replace(/ck/g, "k")
    .replace(/dt/g, "t")
    .replace(/tz/g, "z")
    .replace(/v/g, "f")
    .replace(/w/g, "f")
    .replace(/c([eiy])/g, "z$1")
    .replace(/c/g, "k")
    .replace(/(.)\1+/g, "$1"); // collapse repeated chars
}

function matchesSearch(contact: Contact, query: string): boolean {
  if (!query) return true;
  const q = phonetize(query);
  const fields = [
    contact.companyName,
    contact.firstName,
    contact.lastName,
    contact.city,
  ]
    .filter(Boolean)
    .map((f) => phonetize(f!));
  return fields.some((f) => f.includes(q));
}

function sortContacts(contacts: Contact[], query: string): Contact[] {
  if (!query) return contacts;
  const q = phonetize(query);
  const startsWith = contacts.filter((c) =>
    [c.companyName, c.firstName, c.lastName]
      .filter(Boolean)
      .some((f) => phonetize(f!).startsWith(q))
  );
  const rest = contacts.filter((c) => !startsWith.includes(c));
  return [...startsWith, ...rest];
}

interface ContactComboboxProps {
  contacts: Contact[];
  value: string;
  onChange: (id: string) => void;
}

export function ContactCombobox({ contacts, value, onChange }: ContactComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = contacts.find((c) => c.id === value);

  const filtered = sortContacts(
    contacts.filter((c) => matchesSearch(c, query)),
    query
  );

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  function handleSelect(id: string) {
    onChange(id);
    setOpen(false);
  }

  function getLabel(c: Contact): string {
    const name = c.companyName || [c.firstName, c.lastName].filter(Boolean).join(" ");
    return c.city ? `${name} — ${c.city}` : name;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex h-10 w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        <span className={selected ? "text-gray-900" : "text-gray-400"}>
          {selected ? selected.companyName || [selected.firstName, selected.lastName].filter(Boolean).join(" ") : "Wählen..."}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[320px]"
        align="start"
        sideOffset={4}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
          <Search className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen..."
            className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[260px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-gray-400">
              Kein Kontakt gefunden
            </p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c.id)}
                className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 text-left"
              >
                <span className="text-gray-900 truncate">{getLabel(c)}</span>
                {c.id === value && (
                  <Check className="h-4 w-4 text-blue-600 shrink-0 ml-2" />
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
