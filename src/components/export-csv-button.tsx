"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";

export function ExportCsvButton({ orgId }: { orgId: string }) {
  const t = useTranslations("common");
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => (window["location"]["href"] = `/api/export/invoices?format=csv`)}
    >
      <Download className="mr-2 h-4 w-4" /> {t("exportCsv")}
    </Button>
  );
}
