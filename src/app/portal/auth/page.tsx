"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, Loader2 } from "lucide-react";
import { requestPortalAccess } from "@/lib/actions/portal";

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e["preventDefault"]();
    setLoading(true);
    setMessage(null);

    try {
      const result = await requestPortalAccess(email);
      setMessage({ type: "success", text: result["message"] || "Check your email for a login link." });
    } catch (err: any) {
      setMessage({ type: "error", text: err["message"] || "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Sign in to your account</CardTitle>
          <CardDescription>
            Enter your email address and we&apos;ll send you a secure login link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e["target"]["value"])}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                </>
              ) : (
                "Send Login Link"
              )}
            </Button>
          </form>

          {message && (
            <div
              className={`mt-4 p-3 rounded-md text-sm ${
                message["type"] === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {message["text"]}
            </div>
          )}

          <p className="mt-4 text-xs text-muted-foreground text-center">
            This link expires in 15 minutes. Check your spam folder if you don&apos;t see it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
