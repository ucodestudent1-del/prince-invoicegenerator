"use client";

import { Button } from "@/components/ui/button";

export function ConfirmSubmit({ message }: { message: string }) {
  return (
    <Button
      type="submit"
      variant="destructive"
      size="sm"
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      Remove all
    </Button>
  );
}
