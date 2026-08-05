"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const addressTypes = [
  { value: "BILLING", label: "Billing" },
  { value: "SHIPPING", label: "Shipping" },
];

export function AddressForm({
  customerId,
  onSaved,
}: {
  customerId: string;
  onSaved?: () => void;
}) {
  const [label, setLabel] = React.useState("");
  const [type, setType] = React.useState("BILLING");
  const [line1, setLine1] = React.useState("");
  const [line2, setLine2] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState("");
  const [postalCode, setPostalCode] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [isDefault, setIsDefault] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          label: label || null,
          type,
          line1,
          line2: line2 || null,
          city,
          state: state || null,
          postalCode: postalCode || null,
          country: country || null,
          isDefault,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save address.");
      }
      setLabel("");
      setLine1("");
      setLine2("");
      setCity("");
      setState("");
      setPostalCode("");
      setCountry("");
      setIsDefault(false);
      setError(null);
      onSaved?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="label">Label</Label>
          <Input
            id="label"
            placeholder="e.g. Home, Office"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="type">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {addressTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="line1">Address line 1 *</Label>
        <Input
          id="line1"
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="line2">Address line 2</Label>
        <Input
          id="line2"
          value={line2}
          onChange={(e) => setLine2(e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="city">City *</Label>
          <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="state">State / Province</Label>
          <Input id="state" value={state} onChange={(e) => setState(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="postalCode">Postal code</Label>
          <Input id="postalCode" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="country">Country</Label>
          <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isDefault"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
        />
        <Label htmlFor="isDefault" className="font-normal">
          Set as default {type.toLowerCase()} address
        </Label>
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save address"}
      </Button>
    </form>
  );
}

export function AddressBook({ customerId }: { customerId: string }) {
  const [addresses, setAddresses] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  async function load() {
    try {
      const res = await fetch(`/api/addresses?customerId=${customerId}`);
      if (res.ok) {
        const data = await res.json();
        setAddresses(data);
      }
    } catch (err) {
      console.error("Failed to load addresses", err);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading addresses…</p>;
  }

  if (addresses.length === 0) {
    return <p className="text-sm text-muted-foreground">No saved addresses yet.</p>;
  }

  return (
    <div className="space-y-3">
      {addresses.map((addr) => (
        <Card key={addr.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              {addr.label || `${addr.type} address`}
              {addr.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{addr.line1}</p>
            {addr.line2 && <p>{addr.line2}</p>}
            <p>
              {addr.city}
              {addr.state && `, ${addr.state}`}
              {addr.postalCode && ` ${addr.postalCode}`}
            </p>
            {addr.country && <p>{addr.country}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
