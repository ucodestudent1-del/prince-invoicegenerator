"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, AlertCircle } from "lucide-react";
import { inviteTeamMember } from "@/lib/actions/team";

export function InviteTeamMemberForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"OWNER" | "ADMIN" | "MEMBER" | "VIEWER">("MEMBER");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const result = await inviteTeamMember({ email, name, role });
        if (result?.success) {
          setSuccess(`Invitation sent to ${email}`);
          setEmail("");
          setName("");
          setRole("MEMBER");
        } else if (result?.error) {
          setError(result.error);
        }
      } catch (err: any) {
        setError(err?.message ?? "Failed to send invitation.");
      }
    });
  };

  const isFormValid = email.trim() !== "";

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="invite-name">Name</Label>
          <Input
            id="invite-name"
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email *</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="jane@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-role">Role</Label>
        <Select value={role} onValueChange={(val) => setRole(val as typeof role)}>
          <SelectTrigger id="invite-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="OWNER">Owner</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="MEMBER">Member</SelectItem>
            <SelectItem value="VIEWER">Viewer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || !isFormValid}
      >
        {isPending ? "Sending…" : "Send Invitation"}
      </Button>
    </div>
  );
}
