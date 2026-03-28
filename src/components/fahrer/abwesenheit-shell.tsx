"use client";

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { CalendarOff, Trash2, Clock, CheckCircle, XCircle } from "lucide-react";
import { createAbwesenheit, deleteAbwesenheit } from "@/actions/fahrer-features";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const TYPE_LABEL: Record<string, string> = {
  URLAUB: "Urlaub",
  KRANK: "Krankenstand",
  SONSTIGES: "Sonstiges",
};
const TYPE_STYLE: Record<string, string> = {
  URLAUB: "bg-blue-100 text-blue-700",
  KRANK: "bg-red-100 text-red-700",
  SONSTIGES: "bg-gray-100 text-gray-600",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Ausstehend",
  APPROVED: "Genehmigt",
  REJECTED: "Abgelehnt",
};
const STATUS_ICON: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-3.5 w-3.5 text-amber-500" />,
  APPROVED: <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
  REJECTED: <XCircle className="h-3.5 w-3.5 text-red-500" />,
};

type Abwesenheit = {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  notes: string | null;
  status: string;
};

export function AbwesenheitShell({
  clerkUserId,
  userName,
  today,
  history,
}: {
  clerkUserId: string;
  userName: string;
  today: string;
  history: Abwesenheit[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [type, setType] = useState("URLAUB");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [notes, setNotes] = useState("");

  function handleSubmit() {
    if (endDate < startDate) {
      toast.error("Enddatum darf nicht vor Startdatum liegen");
      return;
    }
    startTransition(async () => {
      await createAbwesenheit({
        clerkUserId,
        driverName: userName,
        type,
        startDate,
        endDate,
        notes: notes || undefined,
      });
      toast.success("Antrag eingereicht");
      setNotes("");
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteAbwesenheit(id);
      toast.success("Gelöscht");
      router.refresh();
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">Abwesenheit</p>
          <h1 className="text-2xl font-bold text-gray-900">{userName}</h1>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl p-5 mb-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Abwesenheit beantragen</h3>

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Art der Abwesenheit</Label>
            <Select value={type} onValueChange={(v) => v && setType(v)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="URLAUB">Urlaub</SelectItem>
                <SelectItem value="KRANK">Krankenstand</SelectItem>
                <SelectItem value="SONSTIGES">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Von</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Bis</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Bemerkung (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="z.B. Arzttermin, Familienangelegenheit..."
              rows={2}
              className="resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={pending}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors disabled:opacity-50"
          >
            <CalendarOff className="h-4 w-4" />
            Antrag einreichen
          </button>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden">
            <p className="px-5 py-4 text-sm font-semibold text-gray-900 border-b border-gray-100">Meine Anträge</p>
            <div className="divide-y divide-gray-50">
              {history.map((a) => {
                const isPending = a.status === "PENDING";
                return (
                  <div key={a.id} className="flex items-start px-5 py-4 gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_STYLE[a.type]}`}>
                          {TYPE_LABEL[a.type]}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          {STATUS_ICON[a.status]} {STATUS_LABEL[a.status]}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {format(parseISO(a.startDate), "dd. MMM", { locale: de })}
                        {a.startDate !== a.endDate && ` – ${format(parseISO(a.endDate), "dd. MMM yyyy", { locale: de })}`}
                        {a.startDate === a.endDate && format(parseISO(a.startDate), " yyyy", { locale: de })}
                      </p>
                      {a.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{a.notes}</p>}
                    </div>
                    {isPending && (
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
