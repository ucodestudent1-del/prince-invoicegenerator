"use client";

import * as React from "react";
import { useRouter, getPathnameWithLocale } from "@/i18n/navigation";
import { useLocaleSafe } from "@/hooks/use-locale-safe";
import { signIn } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { APP_NAME } from "@/lib/app-name";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const locale = useLocaleSafe();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function googleLogin() {
    setLoading(true);
    setError(null);
    try {
      await signIn("google", { callbackUrl: getPathnameWithLocale({ href: "/dashboard", locale }) });
    } catch (err: any) {
      setError(err?.message || t("googleSignInFailed"));
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Link href="/" className="mx-auto mb-2 flex items-center gap-2 font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <HardHat className="h-5 w-5" />
            </span>
              {APP_NAME}
          </Link>
          <CardTitle>{t("signInTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={googleLogin}
              disabled={loading}
            >
              {t("googleButton")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}