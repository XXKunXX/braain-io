"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  RefreshCw,
  Unlink,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Info,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import {
  connectCalendar,
  disconnectCalendar,
  updateCalendarSyncSettings,
} from "@/actions/kalender-integration";
import type { CalendarIntegration } from "@prisma/client";

// ── Brand SVGs ────────────────────────────────────────────────────────────────

function GoogleIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function OutlookIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#0078D4"/>
      <path d="M13.5 4h6.5v16H13.5V4z" fill="#50A0E0"/>
      <path d="M4 8.5h9.5V15H4V8.5z" fill="white" fillOpacity="0.9"/>
      <ellipse cx="8.75" cy="11.75" rx="3" ry="3.25" fill="#0078D4"/>
      <path d="M14.5 8h4v1.5h-4V8zm0 3h4v1.5h-4V11zm0 3h4v1.5h-4V14z" fill="white" fillOpacity="0.7"/>
    </svg>
  );
}

function ICloudIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="icloud-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6"/>
          <stop offset="100%" stopColor="#6366F1"/>
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#icloud-grad)"/>
      <path d="M17.5 14.5a3 3 0 0 0-2.6-4.4 4.5 4.5 0 0 0-8.9 1A3 3 0 0 0 7 17h10a3 3 0 0 0 .5-2.5z" fill="white"/>
    </svg>
  );
}

// ── Provider Config ───────────────────────────────────────────────────────────

type Provider = "GOOGLE" | "OUTLOOK" | "ICLOUD";

const PROVIDERS = [
  {
    id: "GOOGLE" as Provider,
    name: "Google Kalender",
    tagline: "Verbinde dein Google-Konto sicher über OAuth",
    icon: GoogleIcon,
    accentColor: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-100",
    authType: "oauth" as const,
    oauthPath: "/api/auth/calendar/google",
    features: ["Aufträge als Termine", "Baustellen-Zeiträume", "Erinnerungen"],
  },
  {
    id: "OUTLOOK" as Provider,
    name: "Microsoft Outlook",
    tagline: "Verbinde Outlook oder Microsoft 365 sicher über OAuth",
    icon: OutlookIcon,
    accentColor: "text-sky-600",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-100",
    authType: "oauth" as const,
    oauthPath: "/api/auth/calendar/outlook",
    features: ["Microsoft 365 Integration", "Aufträge als Termine", "Teams-kompatibel"],
  },
  {
    id: "ICLOUD" as Provider,
    name: "Apple iCloud",
    tagline: "Verbinde via CalDAV mit App-spezifischem Passwort",
    icon: ICloudIcon,
    accentColor: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-100",
    authType: "manual" as const,
    features: ["iPhone & Mac Sync", "Siri-Integration", "Aufträge als Termine"],
  },
] as const;

// ── Toggle Switch ─────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-blue-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ── iCloud Manual Connect Modal ───────────────────────────────────────────────

function ICloudConnectModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [calendarUrl, setCalendarUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    if (!email || !password) {
      toast.error("Bitte E-Mail und App-Passwort eingeben.");
      return;
    }
    setLoading(true);
    const result = await connectCalendar({
      provider: "ICLOUD",
      accountEmail: email,
      calendarUrl: calendarUrl || undefined,
      calendarPassword: password,
    });
    setLoading(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
    } else {
      toast.success("iCloud Kalender erfolgreich verbunden.");
      onClose();
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl bg-indigo-50">
            <ICloudIcon size={28} />
          </div>
          <div>
            <DialogTitle>Apple iCloud verbinden</DialogTitle>
            <DialogDescription className="text-xs mt-0.5">
              Nutze ein App-spezifisches Passwort — nicht dein iCloud-Passwort.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-4 pt-2">
        {/* Security notice */}
        <div className="flex gap-2.5 rounded-lg bg-amber-50 border border-amber-200 p-3">
          <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 space-y-1">
            <p className="font-medium">App-spezifisches Passwort erforderlich</p>
            <p>Erstelle eines unter <span className="font-mono">appleid.apple.com</span> → Anmeldung und Sicherheit → App-spezifische Passwörter.</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Apple-ID (E-Mail) *</Label>
          <Input
            type="email"
            placeholder="deine@icloud.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label>App-spezifisches Passwort *</Label>
          <Input
            type="password"
            placeholder="xxxx-xxxx-xxxx-xxxx"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>CalDAV-URL <span className="text-gray-400 font-normal">(optional)</span></Label>
          <Input
            type="url"
            placeholder="https://caldav.icloud.com/..."
            value={calendarUrl}
            onChange={(e) => setCalendarUrl(e.target.value)}
          />
          <p className="text-xs text-gray-400">
            Leer lassen = Haupt-Kalender. Zu finden unter iCloud.com → Kalender → Freigabe.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button onClick={handleConnect} disabled={loading}>
            {loading ? "Verbinden..." : "Verbinden"}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

// ── Connected Card ────────────────────────────────────────────────────────────

function ConnectedCard({
  integration,
  provider,
}: {
  integration: CalendarIntegration;
  provider: (typeof PROVIDERS)[number];
}) {
  const [expanded, setExpanded] = useState(false);
  const [settings, setSettings] = useState({
    syncEnabled: integration.syncEnabled,
    syncOrders: integration.syncOrders,
    syncBaustellen: integration.syncBaustellen,
    syncTasks: integration.syncTasks,
  });
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const isError = integration.status === "ERROR";

  async function handleToggle(field: keyof typeof settings, value: boolean) {
    const prev = settings;
    const next = { ...settings, [field]: value };
    setSettings(next);
    setSaving(true);
    const result = await updateCalendarSyncSettings(integration.provider, next);
    setSaving(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      setSettings(prev);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    const result = await disconnectCalendar(integration.provider);
    setDisconnecting(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
    } else {
      toast.success(`${provider.name} getrennt.`);
    }
  }

  return (
    <div className={`border rounded-xl overflow-hidden ${isError ? "border-red-200" : "border-gray-200"}`}>
      <div className="flex items-center gap-4 p-4">
        <div className={`p-2.5 rounded-xl ${provider.bgColor} shrink-0`}>
          <provider.icon size={26} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-gray-900 text-sm">{provider.name}</p>
            {isError ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                <AlertCircle className="h-3 w-3" />
                Fehler
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                <CheckCircle2 className="h-3 w-3" />
                Verbunden
              </span>
            )}
            {!settings.syncEnabled && !isError && (
              <span className="text-xs text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
                Pausiert
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{integration.accountEmail}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saving && <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Sync-Einstellungen
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">Synchronisation aktiv</p>
                <p className="text-xs text-gray-400">Alle Sync-Regeln ein-/ausschalten</p>
              </div>
              <Toggle checked={settings.syncEnabled} onChange={(v) => handleToggle("syncEnabled", v)} />
            </div>

            <div className="border-t border-gray-200 pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Aufträge</p>
                  <p className="text-xs text-gray-400">Start- und Enddatum als Kalenderereignis</p>
                </div>
                <Toggle
                  checked={settings.syncOrders}
                  onChange={(v) => handleToggle("syncOrders", v)}
                  disabled={!settings.syncEnabled}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Baustellen</p>
                  <p className="text-xs text-gray-400">Baustellen-Laufzeiten synchronisieren</p>
                </div>
                <Toggle
                  checked={settings.syncBaustellen}
                  onChange={(v) => handleToggle("syncBaustellen", v)}
                  disabled={!settings.syncEnabled}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Aufgaben</p>
                  <p className="text-xs text-gray-400">Fälligkeitsdaten als Erinnerungen</p>
                </div>
                <Toggle
                  checked={settings.syncTasks}
                  onChange={(v) => handleToggle("syncTasks", v)}
                  disabled={!settings.syncEnabled}
                />
              </div>
            </div>
          </div>

          <div className="pt-1 border-t border-gray-200 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {integration.lastSyncAt
                ? `Zuletzt synchronisiert: ${new Date(integration.lastSyncAt).toLocaleString("de-AT", { dateStyle: "short", timeStyle: "short" })}`
                : "Noch nicht synchronisiert"}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-1.5 text-xs h-7"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              <Unlink className="h-3.5 w-3.5" />
              {disconnecting ? "Trennen..." : "Verbindung trennen"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Available Provider Card ───────────────────────────────────────────────────

function ProviderCard({
  provider,
  onConnectManual,
}: {
  provider: (typeof PROVIDERS)[number];
  onConnectManual: () => void;
}) {
  return (
    <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
      <div className={`p-2.5 rounded-xl ${provider.bgColor} shrink-0`}>
        <provider.icon size={26} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm">{provider.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">{provider.tagline}</p>
      </div>
      <div className="shrink-0">
        {provider.authType === "oauth" ? (
          <a href={provider.oauthPath}>
            <Button size="sm" className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" />
              Anmelden
            </Button>
          </a>
        ) : (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onConnectManual}>
            Verbinden
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main Client Component ─────────────────────────────────────────────────────

type Props = {
  integrations: CalendarIntegration[];
};

export function KalenderIntegrationClient({ integrations }: Props) {
  const [showICloudModal, setShowICloudModal] = useState(false);
  const searchParams = useSearchParams();

  // Show toast on OAuth callback result
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    if (success === "google") toast.success("Google Kalender erfolgreich verbunden.");
    if (success === "outlook") toast.success("Outlook Kalender erfolgreich verbunden.");
    if (error === "access_denied") toast.error("Anmeldung abgebrochen.");
    if (error && error !== "access_denied") toast.error(`Verbindungsfehler: ${error}`);
  }, [searchParams]);

  const connectedIds = new Set(integrations.map((i) => i.provider));
  const connectedProviders = PROVIDERS.filter((p) => connectedIds.has(p.id));
  const availableProviders = PROVIDERS.filter((p) => !connectedIds.has(p.id));

  return (
    <div className="max-w-2xl space-y-6">

      {/* Info Banner */}
      <Card className="border-blue-100 bg-blue-50/50">
        <CardContent className="py-4 px-5">
          <div className="flex gap-3">
            <CalendarDays className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-800">
                Automatische Kalender-Synchronisation
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Verbinde deinen Kalender, damit Aufträge, Baustellen und Aufgaben automatisch als
                Termine eingetragen werden. Google und Outlook nutzen sichere OAuth-Anmeldung —
                du wirst direkt beim Anbieter eingeloggt, kein Passwort wird bei uns gespeichert.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected Integrations */}
      {connectedProviders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Verbundene Kalender ({connectedProviders.length})
          </h2>
          <div className="space-y-2">
            {connectedProviders.map((provider) => {
              const integration = integrations.find((i) => i.provider === provider.id)!;
              return (
                <ConnectedCard key={provider.id} integration={integration} provider={provider} />
              );
            })}
          </div>
        </div>
      )}

      {/* Available Providers */}
      {availableProviders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">
            {connectedProviders.length > 0 ? "Weiteren Kalender hinzufügen" : "Kalender verbinden"}
          </h2>
          <div className="space-y-2">
            {availableProviders.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                onConnectManual={() => provider.id === "ICLOUD" && setShowICloudModal(true)}
              />
            ))}
          </div>
        </div>
      )}

      {/* iCloud Modal */}
      <Dialog open={showICloudModal} onOpenChange={setShowICloudModal}>
        <ICloudConnectModal onClose={() => setShowICloudModal(false)} />
      </Dialog>
    </div>
  );
}
