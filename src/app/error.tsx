"use client";

import { useEffect } from "react";

export default function RootError({
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
        location: "Root Error Boundary",
        url:      window.location.href,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4 max-w-md px-6">
        <p className="text-5xl font-bold text-gray-200">!</p>
        <h1 className="text-xl font-semibold text-gray-800">Unerwarteter Fehler</h1>
        <p className="text-sm text-gray-500">
          Ein Fehler ist aufgetreten. Das Team wurde automatisch benachrichtigt.
        </p>
        <button
          onClick={reset}
          className="inline-block mt-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}
