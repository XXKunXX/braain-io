"use client";

import { useState } from "react";
import { Bot, User, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type StoredMessage = { role: string; text: string; ts: string };

interface Conversation {
  id: string;
  clerkUserId: string;
  userName: string | null;
  userEmail: string | null;
  messages: unknown;
  escalated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function SupportConversationList({ conversations }: { conversations: Conversation[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (conversations.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">
        Noch keine Support-Gespräche vorhanden.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.map((conv) => {
        const messages = (conv.messages as StoredMessage[]) ?? [];
        const userMessages = messages.filter((m) => m.role === "user");
        const isOpen = expanded === conv.id;
        const preview = userMessages[0]?.text ?? "–";

        return (
          <div key={conv.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Row */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              onClick={() => setExpanded(isOpen ? null : conv.id)}
            >
              <div className="flex-shrink-0">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {conv.userName || conv.userEmail || conv.clerkUserId}
                  </span>
                  {conv.escalated && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      <AlertCircle className="h-3 w-3" />
                      Eskaliert
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">{preview}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-xs text-gray-400">
                  {new Date(conv.updatedAt).toLocaleDateString("de-AT")}
                </p>
                <p className="text-xs text-gray-400">
                  {messages.length} Nachrichten
                </p>
              </div>
            </button>

            {/* Expanded messages */}
            {isOpen && (
              <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-2 items-start",
                      msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div
                      className={cn(
                        "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
                        msg.role === "user" ? "bg-blue-600" : "bg-gray-300"
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
                        "max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap",
                        msg.role === "user"
                          ? "bg-blue-600 text-white rounded-tr-sm"
                          : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
                      )}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
