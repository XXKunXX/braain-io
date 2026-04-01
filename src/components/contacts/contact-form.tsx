"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import type { ContactFormData } from "@/actions/contacts";

const schema = z
  .object({
    companyName: z.string().optional().or(z.literal("")),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email("Ungültige E-Mail").optional().or(z.literal("")),
    phone: z.string().optional(),
    address: z.string().optional(),
    postalCode: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    type: z.enum(["COMPANY", "PRIVATE", "SUPPLIER"]),
    owner: z.string().optional().or(z.literal("")),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type !== "PRIVATE" && !data.companyName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Name ist erforderlich",
        path: ["companyName"],
      });
    }
  });

const typeLabels: Record<string, string> = {
  COMPANY: "Firma",
  PRIVATE: "Privatkunde",
  SUPPLIER: "Lieferant",
};

interface ContactFormProps {
  defaultValues?: Partial<ContactFormData>;
  onSubmit: (data: ContactFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  userNames?: string[];
}

export function ContactForm({
  defaultValues,
  onSubmit,
  onCancel,
  isLoading,
  userNames = [],
}: ContactFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(schema),
    defaultValues: { country: "Österreich", type: "COMPANY", ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Typ */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">Kontakttyp *</Label>
        <Select
          value={watch("type")}
          onValueChange={(v) => v && setValue("type", v as ContactFormData["type"])}
        >
          <SelectTrigger className="h-11 rounded-xl border-gray-200 w-full">
            <SelectValue>{typeLabels[watch("type")]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(typeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Name / Firmenname */}
      {watch("type") !== "PRIVATE" && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">Firmenname *</Label>
          <Input {...register("companyName")} className="h-11 rounded-xl border-gray-200" />
          {errors.companyName && (
            <p className="text-xs text-red-500">{errors.companyName.message}</p>
          )}
        </div>
      )}

      {/* Vorname + Nachname */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">
            {watch("type") === "PRIVATE" ? "Vorname *" : "Vorname (Ansprechpartner)"}
          </Label>
          <Input {...register("firstName")} className="h-11 rounded-xl border-gray-200" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">
            {watch("type") === "PRIVATE" ? "Nachname *" : "Nachname (Ansprechpartner)"}
          </Label>
          <Input {...register("lastName")} className="h-11 rounded-xl border-gray-200" />
        </div>
      </div>

      {/* Owner */}
      {userNames.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">Owner</Label>
          <Select
            value={watch("owner") ?? ""}
            onValueChange={(v) => setValue("owner", v == null || v === "__none__" ? undefined : v)}
          >
            <SelectTrigger className="h-11 rounded-xl border-gray-200 w-full">
              <SelectValue>{watch("owner") || <span className="text-gray-400">Kein Owner</span>}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Kein Owner</SelectItem>
              {userNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Telefon + E-Mail */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">Telefon</Label>
          <Input {...register("phone")} type="tel" className="h-11 rounded-xl border-gray-200" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">E-Mail</Label>
          <Input {...register("email")} type="email" className="h-11 rounded-xl border-gray-200" />
          {errors.email && (
            <p className="text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>
      </div>

      {/* Straße */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">Straße</Label>
        <Input {...register("address")} className="h-11 rounded-xl border-gray-200" />
      </div>

      {/* PLZ + Stadt */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">PLZ</Label>
          <Input {...register("postalCode")} className="h-11 rounded-xl border-gray-200" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">Stadt</Label>
          <Input {...register("city")} className="h-11 rounded-xl border-gray-200" />
        </div>
      </div>

      {/* Land */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">Land</Label>
        <Input {...register("country")} className="h-11 rounded-xl border-gray-200" />
      </div>

      {/* Notizen */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">Notizen</Label>
        <Textarea
          {...register("notes")}
          rows={3}
          className="rounded-xl border-gray-200 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="rounded-lg">
            Abbrechen
          </Button>
        )}
        <Button type="submit" disabled={isLoading} className="rounded-lg">
          {isLoading ? "Speichert..." : "Speichern"}
        </Button>
      </div>
    </form>
  );
}
