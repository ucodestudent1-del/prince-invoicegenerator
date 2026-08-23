"use client";

import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";

export function CopyShareLinkButton({ url }: { url: string }) {
  const t = useTranslations("estimates");
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        navigator["clipboard"]["writeText"](url);
      }}
    >
      <Copy className="mr-2 h-4 w-4" /> {t("copyLink")}
    </Button>
  );
}
