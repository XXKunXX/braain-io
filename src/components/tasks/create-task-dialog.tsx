"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTask, type TaskFormData } from "@/actions/tasks";
import { toast } from "sonner";

const schema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional(),
  contactId: z.string().optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]).default("OPEN"),
});

export function CreateTaskDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { priority: "NORMAL", status: "OPEN" },
  });

  async function onSubmit(data: z.infer<typeof schema>) {
    setLoading(true);
    const result = await createTask(data);
    setLoading(false);
    if (result.error) {
      toast.error("Fehler beim Erstellen");
      return;
    }
    toast.success("Aufgabe erstellt");
    setOpen(false);
    reset();
    router.refresh();
  }

  const priorityLabels: Record<string, string> = {
    LOW: "Niedrig",
    NORMAL: "Normal",
    HIGH: "Hoch",
    URGENT: "Dringend",
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium transition-colors"
      >
        <Plus className="h-4 w-4" />
        Aufgabe erstellen
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Neue Aufgabe</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Titel *</Label>
              <Input {...register("title")} className="h-10 rounded-lg border-gray-200" />
              {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Beschreibung</Label>
              <Textarea {...register("description")} rows={2} className="rounded-lg border-gray-200 resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Zugewiesen an</Label>
                <Input {...register("assignedTo")} className="h-10 rounded-lg border-gray-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Fälligkeit</Label>
                <Input {...register("dueDate")} type="date" className="h-10 rounded-lg border-gray-200" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Priorität</Label>
              <Select
                value={watch("priority")}
                onValueChange={(v) => v && setValue("priority", v as TaskFormData["priority"])}
              >
                <SelectTrigger className="h-10 rounded-lg border-gray-200 w-full">
                  <SelectValue>{priorityLabels[watch("priority") ?? "NORMAL"]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-lg">
                Abbrechen
              </Button>
              <Button type="submit" disabled={loading} className="rounded-lg">
                {loading ? "Speichere..." : "Erstellen"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
