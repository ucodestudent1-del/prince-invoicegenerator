"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link2 } from "lucide-react";
import { linkInvoiceToRecurring } from "@/lib/actions/recurring";

interface InvoiceOption {
  id: string;
  number: string;
  type: string;
}

export function LinkInvoiceForm({
  configId,
  invoices,
}: {
  configId: string;
  invoices: InvoiceOption[];
}) {
  const router = useRouter();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInvoiceId) return;
    setError(null);
    setIsLinking(true);
    try {
      await linkInvoiceToRecurring(selectedInvoiceId, configId);
      setSelectedInvoiceId("");
      router.refresh();
    } catch (err: any) {
      if (err?.digest === "NEXT_REDIRECT") {
        router.push("/login?error=session");
        return;
      }
      setError(err?.message ?? "Failed to link invoice.");
    } finally {
      setIsLinking(false);
    }
  }

  if (invoices.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        No invoices to link
      </span>
    );
  }

  return (
    <form onSubmit={handleLink} className="flex flex-col gap-1">
      <div className="flex gap-2 items-end">
        <Select
          value={selectedInvoiceId}
          onValueChange={setSelectedInvoiceId}
          required
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Link invoice" />
          </SelectTrigger>
          <SelectContent>
            {invoices.map((inv) => (
              <SelectItem key={inv.id} value={inv.id}>
                {inv.number} ({inv.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="submit"
          size="sm"
          disabled={isLinking || !selectedInvoiceId}
          variant="outline"
        >
          <Link2 className="h-4 w-4" />
        </Button>
      </div>
      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </form>
  );
}
