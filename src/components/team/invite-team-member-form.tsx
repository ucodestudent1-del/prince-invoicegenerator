"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, AlertCircle } from "lucide-react";
import { inviteTeamMember } from "@/lib/actions/team";
import { SYSTEM_ROLES } from "@/lib/permissions";
import type { SystemRoleId } from "@/lib/permissions";

export function InviteTeamMemberForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState<SystemRoleId>("project_manager");
  const [jobTitle, setJobTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedRole = SYSTEM_ROLES.find((r) => r.id === roleId);

  const handleSubmit = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const result = await inviteTeamMember({
          email,
          name,
          roleId,
          jobTitle: jobTitle.trim() || null,
        });
        if (result?.success) {
          setSuccess(`Invitation sent to ${email}`);
          setEmail("");
          setName("");
          setRoleId("project_manager");
          setJobTitle("");
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
        <Label htmlFor="invite-jobTitle">Job Title</Label>
        <Input
          id="invite-jobTitle"
          placeholder="e.g. Senior Project Manager"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-role">System Role</Label>
        <Select value={roleId} onValueChange={(val) => setRoleId(val as SystemRoleId)}>
          <SelectTrigger id="invite-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SYSTEM_ROLES.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                <div className="flex flex-col">
                  <span>{r.name}</span>
                  <span className="text-xs text-muted-foreground">{r.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedRole && (
          <p className="text-xs text-muted-foreground">{selectedRole.description}</p>
        )}
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
