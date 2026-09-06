"use client";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL } from "@/components/project-status-badge";
import { PROJECT_TYPES, PROJECT_TYPE_LABEL, type ProjectTypeKey } from "@/lib/project-types";
import { AlertCircle } from "lucide-react";

interface ProjectsFilterBarProps {
  statusFilter: string;
  typeFilter: string;
  customerFilter: string;
  attentionOnly: boolean;
  query: string;
  customers: { id: string; name: string }[];
  t: any;
}

export function ProjectsFilterBar({
  statusFilter,
  typeFilter,
  customerFilter,
  attentionOnly,
  query,
  customers,
  t,
}: ProjectsFilterBarProps) {
  const router = useRouter();

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (value === "all" || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.replace(`${window.location.pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <select
        name="status"
        defaultValue={statusFilter}
        onChange={(e) => updateParam("status", e.target.value)}
        className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
      >
        <option value="all">{t("allStatuses")}</option>
        {PROJECT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {PROJECT_STATUS_LABEL[s]}
          </option>
        ))}
      </select>

      <select
        name="type"
        defaultValue={typeFilter}
        onChange={(e) => updateParam("type", e.target.value)}
        className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
      >
        <option value="all">{t("allTypes")}</option>
        {PROJECT_TYPES.map((pt) => (
          <option key={pt} value={pt}>
            {PROJECT_TYPE_LABEL[pt as ProjectTypeKey]}
          </option>
        ))}
      </select>

      <select
        name="customer"
        defaultValue={customerFilter}
        onChange={(e) => updateParam("customer", e.target.value)}
        className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
      >
        <option value="all">{t("allCustomers")}</option>
        {customers.map((c) => (
          <option key={c["id"]} value={c["id"]}>
            {c["name"]}
          </option>
        ))}
      </select>

      <Button
        asChild={!attentionOnly}
        variant={attentionOnly ? "default" : "outline"}
        size="sm"
      >
        {attentionOnly ? (
          <Link href="/dashboard/projects">{t("allProjects")}</Link>
        ) : (
          <Link
            href={`/dashboard/projects?attention=1${query ? `&q=${encodeURIComponent(query)}` : ""}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}${customerFilter !== "all" ? `&customer=${customerFilter}` : ""}${typeFilter !== "all" ? `&type=${typeFilter}` : ""}`}
          >
            <AlertCircle className="mr-1 h-3 w-3" /> {t("attentionOnly")}
          </Link>
        )}
      </Button>
    </div>
  );
}
