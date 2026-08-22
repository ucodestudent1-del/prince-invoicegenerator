"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { useState } from "react";

export function CustomersSearch({
  initialQuery = "",
  initialStatus = "ACTIVE",
}: {
  initialQuery?: string;
  initialStatus?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (query) params.set("q", query);
    else params.delete("q");
    if (status && status !== "ALL") params.set("status", status);
    else params.delete("status");
    router.push(`/dashboard/customers?${params.toString()}`);
  };

  const clearFilters = () => {
    setQuery("");
    setStatus("ALL");
    router.push("/dashboard/customers");
  };

  return (
    <form onSubmit={handleSearch} className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, company, or email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="rounded-md border border-input bg-transparent px-3 text-sm"
      >
        <option value="ALL">All Status</option>
        <option value="ACTIVE">Active</option>
        <option value="ARCHIVED">Archived</option>
        <option value="SUSPENDED">Suspended</option>
      </select>
      <Button type="submit">Search</Button>
      {(query || status !== "ALL") && (
        <Button type="button" variant="outline" onClick={clearFilters}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </form>
  );
}
