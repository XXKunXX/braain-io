"use client";

import { useEffect, useRef, useState, useCallback, useReducer } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart } from "ai";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageCircleQuestion,
  X,
  Send,
  Bug,
  Lightbulb,
  Paperclip,
  Loader2,
  Bot,
  User,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  AlertCircle,
  PhoneCall,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Tab = "hilfe" | "feedback";
type FeedbackType = "bug" | "feature";

interface SupportWidgetProps {
  canViewSupport: boolean;
  canSubmitFeedback: boolean;
}

export function SupportWidget({ canViewSupport, canSubmitFeedback }: SupportWidgetProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("hilfe");
  const [proactiveShown, setProactiveShown] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const proactiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyboard shortcut: Cmd+?
  useEffect(() => {
    if (!canViewSupport) return;
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.key === "?" && e.metaKey) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [canViewSupport]);

  // Proaktive Hilfe: nach 2 Minuten ohne Interaktion Widget öffnen
  useEffect(() => {
    if (!canViewSupport || proactiveShown || open) return;

    function resetTimer() {
      if (proactiveTimer.current) clearTimeout(proactiveTimer.current);
      proactiveTimer.current = setTimeout(() => {
        setOpen(true);
        setProactiveShown(true);
      }, 2 * 60 * 1000); // 2 Minuten
    }

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => document.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (proactiveTimer.current) clearTimeout(proactiveTimer.current);
      events.forEach((e) => document.removeEventListener(e, resetTimer));
    };
  }, [canViewSupport, proactiveShown, open]);

  // Timer stoppen wenn Widget offen
  useEffect(() => {
    if (open && proactiveTimer.current) {
      clearTimeout(proactiveTimer.current);
    }
  }, [open]);

  // Resize state — nur auf Desktop
  const [panelSize, setPanelSize] = useState({ width: 480, height: 600 });
  const resizing = useRef<{ edge: "top" | "left" | "top-left"; startX: number; startY: number; startW: number; startH: number } | null>(null);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!resizing.current) return;
      const { edge, startX, startY, startW, startH } = resizing.current;
      const dx = startX - e.clientX;
      const dy = startY - e.clientY;
      setPanelSize({
        width:  edge === "top"  ? startW       : Math.max(320, Math.min(900, startW + dx)),
        height: edge === "left" ? startH       : Math.max(300, Math.min(window.innerHeight - 120, startH + dy)),
      });
    }
    function onMouseUp() { resizing.current = null; document.body.style.userSelect = ""; document.body.style.cursor = ""; }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => { document.removeEventListener("mousemove", onMouseMove); document.removeEventListener("mouseup", onMouseUp); };
  }, []);

  function startResize(e: React.MouseEvent, edge: "top" | "left" | "top-left") {
    e.preventDefault();
    resizing.current = { edge, startX: e.clientX, startY: e.clientY, startW: panelSize.width, startH: panelSize.height };
    document.body.style.userSelect = "none";
    document.body.style.cursor = edge === "top" ? "ns-resize" : edge === "left" ? "ew-resize" : "nwse-resize";
  }

  if (!canViewSupport) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        title="Hilfe & Support (⌘?)"
        className={cn(
          "fixed z-50 flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all duration-200",
          "bottom-[calc(4rem+env(safe-area-inset-bottom)+1rem)] right-4",
          "md:bottom-6 md:right-6",
          open
            ? "bg-gray-700 hover:bg-gray-800"
            : "bg-blue-600 hover:bg-blue-700"
        )}
      >
        {open ? (
          <X className="h-5 w-5 text-white" />
        ) : (
          <MessageCircleQuestion className="h-5 w-5 text-white" />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          style={{ width: panelSize.width, height: panelSize.height }}
          className={cn(
            "fixed z-40 flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden",
            "bottom-[calc(4rem+env(safe-area-inset-bottom)+5rem)] right-4 left-4",
            "md:bottom-24 md:right-6 md:left-auto",
          )}
        >
          {/* Resize handle — top edge */}
          <div onMouseDown={(e) => startResize(e, "top")}
            className="hidden md:block absolute top-0 left-4 right-4 h-1.5 cursor-ns-resize z-10 rounded-t-2xl hover:bg-blue-200 transition-colors" />
          {/* Resize handle — left edge */}
          <div onMouseDown={(e) => startResize(e, "left")}
            className="hidden md:block absolute left-0 top-4 bottom-4 w-1.5 cursor-ew-resize z-10 rounded-l-2xl hover:bg-blue-200 transition-colors" />
          {/* Resize handle — top-left corner */}
          <div onMouseDown={(e) => startResize(e, "top-left")}
            className="hidden md:block absolute top-0 left-0 w-4 h-4 cursor-nwse-resize z-20 rounded-tl-2xl hover:bg-blue-200 transition-colors" />

          {/* Header */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)" }}
              >
                <MessageCircleQuestion className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-900">Support & Hilfe</span>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-200 rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab("hilfe")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all",
                  activeTab === "hilfe"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Bot className="h-3.5 w-3.5" />
                Hilfe
              </button>
              {canSubmitFeedback && (
                <button
                  onClick={() => setActiveTab("feedback")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all",
                    activeTab === "feedback"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <Bug className="h-3.5 w-3.5" />
                  Feedback
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === "hilfe" ? (
              <ChatTab
                pathname={pathname}
                messagesEndRef={messagesEndRef}
                canSubmitFeedback={canSubmitFeedback}
                onSwitchToFeedback={() => setActiveTab("feedback")}
                onNavigate={(href) => { router.push(href); }}
              />
            ) : (
              <FeedbackTab />
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Chat Tab ──────────────────────────────────────────────────────────────────

function ChatTab({
  pathname,
  messagesEndRef,
  canSubmitFeedback,
  onSwitchToFeedback,
  onNavigate,
}: {
  pathname: string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  canSubmitFeedback: boolean;
  onSwitchToFeedback: () => void;
  onNavigate: (href: string) => void;
}) {
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [showEscalation, setShowEscalation] = useState(false);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/support/chat",
      body: { currentPath: pathname, conversationId },
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Nach 2 Bot-Antworten ohne Lösung Eskalations-Button anzeigen
  const assistantCount = messages.filter((m) => m.role === "assistant").length;
  useEffect(() => {
    if (assistantCount >= 2 && !showEscalation) {
      setShowEscalation(true);
    }
  }, [assistantCount, showEscalation]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, messagesEndRef]);

  function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage({ text });
    setInput("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 overscroll-contain">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Bot className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700 mb-1">Wie kann ich helfen?</p>
            <p className="text-xs text-gray-400 mb-4">
              Stell mir Fragen zur Bedienung von braain.io.
            </p>
            <div className="space-y-1.5">
              {[
                "Wie erstelle ich eine Rechnung?",
                "Zeig mir meine offenen Aufträge",
                "Wie funktioniert die Disposition?",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => { sendMessage({ text: q }); }}
                  className="block w-full text-left text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-600 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const textContent = msg.parts
            .filter(isTextUIPart)
            .map((p) => p.text)
            .join("");
          if (!textContent) return null;
          return (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2 items-start",
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div
                className={cn(
                  "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
                  msg.role === "user" ? "bg-blue-600" : "bg-gray-200"
                )}
              >
                {msg.role === "user" ? (
                  <User className="h-3.5 w-3.5 text-white" />
                ) : (
                  <Bot className="h-3.5 w-3.5 text-gray-600" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed",
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-sm whitespace-pre-wrap"
                    : "bg-gray-100 text-gray-800 rounded-tl-sm"
                )}
              >
                {msg.role === "user" ? textContent : (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      h1: ({ children }) => <p className="font-semibold text-sm mb-1">{children}</p>,
                      h2: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
                      h3: ({ children }) => <p className="font-medium mb-1">{children}</p>,
                      ul: ({ children }) => <ul className="mb-2 space-y-1.5 pl-0 list-none">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                      li: ({ children }) => (
                        <li className="flex items-start gap-1.5 bg-white/60 rounded-lg px-2 py-1.5 border border-gray-200 text-[11px] leading-snug">
                          <span className="mt-0.5 text-gray-300 flex-shrink-0">›</span>
                          <span className="flex-1 min-w-0">{children}</span>
                        </li>
                      ),
                      code: ({ children }) => <code className="bg-gray-200 rounded px-1 font-mono text-[11px]">{children}</code>,
                      a: ({ href, children }) => {
                        const isInternal = href?.startsWith("/");
                        return isInternal ? (
                          <button
                            type="button"
                            onClick={() => onNavigate(href!)}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                          >
                            {children}
                          </button>
                        ) : (
                          <a href={href} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">{children}</a>
                        );
                      },
                    }}
                  >
                    {textContent}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-2 items-start">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
              <Bot className="h-3.5 w-3.5 text-gray-600" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2">
              <Loader2 className="h-3.5 w-3.5 text-gray-400 animate-spin" />
            </div>
          </div>
        )}

        {/* Eskalations-Hinweis nach mehreren Bot-Antworten */}
        {showEscalation && messages.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-amber-800 mb-1">
                  Nicht die richtige Antwort gefunden?
                </p>
                <div className="flex gap-2 flex-wrap">
                  {canSubmitFeedback && (
                    <button
                      onClick={onSwitchToFeedback}
                      className="flex items-center gap-1 text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-2 py-1 rounded-lg transition-colors"
                    >
                      <Bug className="h-3 w-3" />
                      Ticket erstellen
                    </button>
                  )}
                  <button
                    onClick={() => setShowEscalation(false)}
                    className="text-xs text-amber-600 hover:text-amber-800 px-2 py-1 transition-colors"
                  >
                    Weiter chatten
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-100 p-3 flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Frage stellen…"
          rows={1}
          disabled={isLoading}
          className="flex-1 resize-none text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 max-h-24 overflow-y-auto"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="flex-shrink-0 w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-colors"
        >
          <Send className="h-3.5 w-3.5 text-white" />
        </button>
      </div>
    </div>
  );
}

// ── Feedback Tab ──────────────────────────────────────────────────────────────

function FeedbackTab() {
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedUrl, setSubmittedUrl] = useState<string | null | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) { setScreenshot(file); toast.success("Screenshot eingefügt"); }
        break;
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  function reset() {
    setFeedbackType(null);
    setTitle("");
    setDescription("");
    setScreenshot(null);
    setSubmittedUrl(undefined);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!feedbackType || !title.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("type", feedbackType);
      fd.append("title", title.trim());
      fd.append("description", description.trim());
      if (screenshot) fd.append("screenshot", screenshot);
      const res = await fetch("/api/support/feedback", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unbekannter Fehler");
      setSubmittedUrl(data.taskUrl ?? null);
      toast.success("Feedback wurde erfolgreich gesendet!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Senden");
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedUrl !== undefined) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
        <p className="text-sm font-semibold text-gray-900 mb-1">Danke für dein Feedback!</p>
        <p className="text-xs text-gray-500 mb-4">
          Deine Meldung wurde übermittelt und wird so bald wie möglich bearbeitet.
        </p>
        {submittedUrl && (
          <a href={submittedUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline mb-4">
            Im ClickUp ansehen <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-700 underline">
          Weiteres Feedback senden
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-700 mb-2">Was möchtest du melden?</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setFeedbackType("bug")}
              className={cn("flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition-all",
                feedbackType === "bug" ? "border-red-400 bg-red-50 text-red-700" : "border-gray-200 hover:border-gray-300 text-gray-600")}>
              <Bug className="h-5 w-5" />
              <span className="text-xs font-medium">Fehler melden</span>
            </button>
            <button type="button" onClick={() => setFeedbackType("feature")}
              className={cn("flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition-all",
                feedbackType === "feature" ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300 text-gray-600")}>
              <Lightbulb className="h-5 w-5" />
              <span className="text-xs font-medium">Feature wünschen</span>
            </button>
          </div>
        </div>

        {feedbackType && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {feedbackType === "bug" ? "Was ist der Fehler?" : "Was wünschst du dir?"}
              </label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder={feedbackType === "bug" ? "z.B. Rechnung kann nicht gespeichert werden" : "z.B. Export als Excel-Datei"}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Beschreibung</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder={feedbackType === "bug" ? "Beschreibe was passiert ist…" : "Beschreibe was du dir vorstellst…"}
                rows={4}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" required />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Screenshot <span className="font-normal text-gray-400">(optional)</span>
              </label>
              {screenshot ? (
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <Paperclip className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-600 flex-1 truncate">{screenshot.name || "screenshot.png"}</span>
                  <button type="button" onClick={() => setScreenshot(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-3 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors">
                  <Paperclip className="h-3.5 w-3.5" />
                  Datei auswählen oder Screenshot einfügen (⌘V)
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setScreenshot(f); }} />
            </div>

            <button type="submit" disabled={submitting || !title.trim() || !description.trim()}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white disabled:text-gray-400 text-xs font-medium py-2.5 rounded-xl transition-colors">
              {submitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Wird gesendet…</> : <><Send className="h-3.5 w-3.5" />{feedbackType === "bug" ? "Fehler melden" : "Feature einreichen"}</>}
            </button>

            <button type="button" onClick={() => setFeedbackType(null)}
              className="w-full flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <ChevronLeft className="h-3 w-3" />Zurück
            </button>
          </>
        )}
      </form>
    </div>
  );
}
