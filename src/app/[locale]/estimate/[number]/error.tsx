"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EstimateError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console["error"]("Estimate page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900">
          {t("estimateLoadFailed")}
        </h1>
        <p className="text-sm text-gray-500">
          {t("estimateLoadFailedDescription")}
        </p>
        {error["digest"] && (
          <p className="text-xs text-gray-400 font-mono">
            {t("errorId", { id: error["digest"] })}
          </p>
        )}
        <Button onClick={reset} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("tryAgain")}
        </Button>
      </div>
    </div>
  );
}
