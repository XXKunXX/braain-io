"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteUser } from "@/actions/users";
import { toast } from "sonner";

const roles = ["Admin", "Backoffice", "Fahrer"];

export function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Backoffice");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function resetForm() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setRole("Backoffice");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !firstName || !lastName) return;
    setLoading(true);
    const result = await inviteUser({ email, firstName, lastName, role });
    setLoading(false);

    if ("error" in result && result.error) {
      if (result.error.toLowerCase().includes("already")) {
        toast.error("Diese E-Mail ist bereits registriert oder eingeladen.");
      } else {
        toast.error(`Fehler: ${result.error}`);
      }
      return;
    }

    toast.success(`Einladung an ${email} gesendet`);
    setOpen(false);
    resetForm();
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
      >
        <Plus className="h-4 w-4" />
        Benutzer hinzufügen
      </button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Benutzer einladen</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* Vorname + Nachname */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Vorname *</Label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="h-10 rounded-lg border-gray-200"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Nachname *</Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="h-10 rounded-lg border-gray-200"
                  required
                />
              </div>
            </div>

            {/* E-Mail */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">E-Mail-Adresse *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 rounded-lg border-gray-200"
                required
              />
            </div>

            {/* Rolle */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Rolle *</Label>
              <Select value={role} onValueChange={(v) => v != null && setRole(v)}>
                <SelectTrigger className="h-10 rounded-lg border-gray-200 w-full">
                  <SelectValue>{role}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-gray-400">
              Der Benutzer erhält eine Einladungs-E-Mail zum Registrieren.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-lg">
                Abbrechen
              </Button>
              <Button type="submit" disabled={loading} className="rounded-lg">
                {loading ? "Wird gesendet..." : "Einladung senden"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
