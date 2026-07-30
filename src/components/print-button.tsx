"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintButton() {
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.indexOf("auto") > -1) {
      window.print();
    }
  }, []);

  return (
    <Button onClick={() => window.print()}>
      <Printer className="mr-2 h-4 w-4" /> Print / Save as PDF
    </Button>
  );
}
