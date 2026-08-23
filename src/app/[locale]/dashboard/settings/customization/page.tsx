"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

export default function CustomizationRedirect() {
  const router = useRouter();
  useEffect(() => {
    router["replace"]("/dashboard/settings/templates");
  }, [router]);
  return null;
}
