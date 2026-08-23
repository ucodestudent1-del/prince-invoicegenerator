"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { generateNextInvoice } from "@/lib/actions/recurring";

export function GenerateInvoiceButton({ configId }: { configId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function handleGenerate(e: React.FormEvent) {
    e["preventDefault"]();
    setError(null);
    setGenerating(true);
    try {
      const invoice = await generateNextInvoice(configId);
      if (invoice?.["id"]) {
        router["push"](`/dashboard/invoices/${invoice["id"]}`);
      }
    } catch (err: any) {
      if (err?.["digest"] === "NEXT_REDIRECT") {
        router["push"]("/login?error=session");
        return;
      }
      setError(err?.["message"] ?? "Failed to generate invoice.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <form onSubmit={handleGenerate}>
      <Button type="submit" variant="outline" size="sm" disabled={generating}>
        <Zap className="h-4 w-4" />
      </Button>
      {error && (
        <div className="mt-1 text-xs text-destructive max-w-[200px]">{error}</div>
      )}
    </form>
  );
}
