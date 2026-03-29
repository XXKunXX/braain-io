"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { Send, MessageSquare } from "lucide-react";
import { sendChatMessage, markMessagesRead } from "@/actions/fahrer-features";
import { toast } from "sonner";

type Message = {
  id: string;
  fromUserId: string;
  fromName: string;
  toDriverId: string | null;
  message: string;
  read: boolean;
  createdAt: string;
};

export function NachrichtenShell({
  clerkUserId,
  userName,
  messages,
}: {
  clerkUserId: string;
  userName: string;
  messages: Message[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Mark messages as read and scroll to bottom on mount
  useEffect(() => {
    markMessagesRead(clerkUserId).catch(() => {});
    bottomRef.current?.scrollIntoView();
  }, [clerkUserId]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(interval);
  }, [router]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await sendChatMessage({
        fromUserId: clerkUserId,
        fromName: userName,
        message: trimmed,
      });
      setText("");
      router.refresh();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="max-w-2xl mx-auto w-full flex flex-col flex-1 px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">Nachrichten</p>
          <h1 className="text-2xl font-bold text-gray-900">Büro-Chat</h1>
        </div>

        {/* Message list */}
        <div className="flex-1 bg-white rounded-2xl p-4 mb-4 space-y-3 overflow-y-auto min-h-[300px] max-h-[60vh]">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-10">
              <MessageSquare className="h-8 w-8 text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">Noch keine Nachrichten</p>
            </div>
          )}
          {messages.map((msg) => {
            const isOwn = msg.fromUserId === clerkUserId;
            return (
              <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  isOwn
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-900 rounded-bl-sm"
                }`}>
                  {!isOwn && (
                    <p className="text-xs font-semibold mb-0.5 text-blue-600">{msg.fromName}</p>
                  )}
                  <p className="text-sm leading-relaxed">{msg.message}</p>
                  <p className={`text-xs mt-1 ${isOwn ? "text-blue-200" : "text-gray-400"}`}>
                    {format(new Date(msg.createdAt), "HH:mm", { locale: de })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="bg-white rounded-2xl p-3 flex items-center gap-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nachricht schreiben..."
            className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400 py-1"
          />
          <button
            onClick={handleSend}
            disabled={pending || !text.trim()}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
