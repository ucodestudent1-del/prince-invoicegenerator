"use client";

import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export function ConfirmSubmit({ message }: { message: string }) {
  const t = useTranslations("common");
  return (
    <Button
      type="submit"
      variant="destructive"
      size="sm"
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {t("removeAll")}
    </Button>
  );
}
