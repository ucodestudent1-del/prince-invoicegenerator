"use client";

import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function UserMenu({ email, name }: { email?: string | null; name?: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">{email}</span>
      <Avatar>
        <AvatarFallback>{(name ?? "U").slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Sign out
      </button>
    </div>
  );
}
