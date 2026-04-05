"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/report-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message:  error.message,
        stack:    error.stack,
        location: "App Error Boundary",
        url:      window.location.href,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 space-y-4">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
        <span className="text-red-400 text-xl font-bold">!</span>
      </div>
      <h2 className="text-lg font-semibold text-gray-800">Etwas ist schiefgelaufen</h2>
      <p className="text-sm text-gray-500 max-w-sm">
        Ein Fehler ist aufgetreten. Das Team wurde automatisch benachrichtigt und kümmert sich darum.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Erneut versuchen
        </button>
        <a
          href="/dashboard"
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
        >
          Zum Dashboard
        </a>
      </div>
    </div>
  );
}
