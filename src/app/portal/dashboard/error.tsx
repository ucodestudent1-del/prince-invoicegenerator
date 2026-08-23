"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PortalDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console["error"]("Portal dashboard error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900">
          Unable to load dashboard
        </h1>
        <p className="text-sm text-gray-500">
          We couldn&apos;t load your dashboard. Please try again.
        </p>
        {error["digest"] && (
          <p className="text-xs text-gray-400 font-mono">
            Error ID: {error["digest"]}
          </p>
        )}
        <Button onClick={reset} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    </div>
  );
}
