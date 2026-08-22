"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocaleSafe } from "@/hooks/use-locale-safe";
import { Link } from "@/i18n/navigation";
import { getPathnameWithLocale } from "@/i18n/navigation";
import { HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";
import { APP_NAME } from "@/lib/app-name";
import { resetPassword } from "@/lib/actions/auth";

export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const locale = useLocaleSafe();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      setLoading(false);
      return;
    }

    if (!token) {
      setError(t("invalidResetToken"));
      setLoading(false);
      return;
    }

    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || t("unexpectedError"));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
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
            <CardTitle>{t("invalidResetToken")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-sm text-muted-foreground">
              This reset link is invalid or has expired.
            </p>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              <Link href="/forgot-password" className="text-primary hover:underline">
                {t("backToLogin")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
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
          <CardTitle>{t("resetPasswordTitle")}</CardTitle>
          <CardDescription>{t("resetPasswordDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {success ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your password has been reset. You can now sign in with your new password.
              </p>
              <Button
                className="w-full"
                onClick={() =>
                  router.push(getPathnameWithLocale({ href: "/login", locale }))
                }
              >
                {t("signIn")}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="password">{t("newPassword")} *</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirmPassword">{t("confirmPassword")} *</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("loading") : t("resetPasswordButton")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
