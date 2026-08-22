"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { verifyMagicLink } from "@/lib/actions/auth";
import { signIn } from "next-auth/react";
import { APP_NAME } from "@/lib/app-name";

function MagicLinkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [signingIn, setSigningIn] = React.useState(false);

  React.useEffect(() => {
    async function verify() {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const result = await verifyMagicLink(token);
        if (result.success && result.email) {
          setSigningIn(true);
          const signInResult = await signIn("credentials", {
            email: result.email,
            magicToken: token,
            redirect: false,
          });
          if (signInResult?.error) {
            setError("Invalid or expired magic link. Please try again.");
            setSigningIn(false);
          } else {
            router.push("/dashboard");
            router.refresh();
          }
        }
      } catch (err: any) {
        setError(err?.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    }
    verify();
  }, [token, router]);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <Link href="/" className="mx-auto mb-2 flex items-center gap-2 font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <HardHat className="h-5 w-5" />
          </span>
          {APP_NAME}
        </Link>
        <CardTitle>Signing in…</CardTitle>
        <CardDescription>Verifying your magic link.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {signingIn && (
          <p className="text-center text-sm text-muted-foreground">Signing in…</p>
        )}
        {!signingIn && !error && (
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        )}
        {error && (
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">Back to login</Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function MagicLinkPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <React.Suspense fallback={<div className="w-full max-w-sm"><Card><CardContent><p className="text-center text-sm text-muted-foreground">Loading…</p></CardContent></Card></div>}>
        <MagicLinkContent />
      </React.Suspense>
    </div>
  );
}
