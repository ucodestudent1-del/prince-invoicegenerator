"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocaleSafe } from "@/hooks/use-locale-safe";
import { Link } from "@/i18n/navigation";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { verifyEmail, resendVerificationEmail } from "@/lib/actions/auth";
import { APP_NAME } from "@/lib/app-name";

export default function VerifyEmailPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const locale = useLocaleSafe();
  const searchParams = useSearchParams();
  const token = searchParams["get"]("token");
  const sent = searchParams["get"]("sent");

  const [loading, setLoading] = React["useState"](false);
  const [resendLoading, setResendLoading] = React["useState"](false);
  const [error, setError] = React["useState"]<string | null>(null);
  const [success, setSuccess] = React["useState"](false);

  React["useEffect"](() => {
    async function verify() {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        await verifyEmail(token);
        setSuccess(true);
      } catch (err: any) {
        setError(err?.["message"] || t("unexpectedError"));
      } finally {
        setLoading(false);
      }
    }
    verify();
  }, [token, t]);

  async function handleResend() {
    setResendLoading(true);
    setError(null);
    try {
      await resendVerificationEmail();
    } catch (err: any) {
      setError(err?.["message"] || t("unexpectedError"));
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Link href="/" className="mx-auto mb-2 flex items-center gap-2 font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Receipt className="h-5 w-5" />
            </span>
            {APP_NAME}
          </Link>
          <CardTitle>{t("verifyEmailTitle")}</CardTitle>
          <CardDescription>{t("verifyEmailDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-700">
              {t("verifyEmailSuccess")}{" "}
              <Link href="/onboarding" className="font-medium underline">
                {t("continueToOnboarding")}
              </Link>
            </div>
          )}
          {sent === "1" && !token && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("checkYourEmailDescription")}
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleResend}
                disabled={resendLoading}
              >
                {resendLoading ? t("loading") : t("verifyEmailResend")}
              </Button>
            </div>
          )}
          {!token && !sent && (
            <p className="text-center text-sm text-muted-foreground">
              {t("didntReceiveEmail")}{" "}
              <Button
                variant="link"
                className="h-auto p-0 text-sm"
                onClick={handleResend}
                disabled={resendLoading}
              >
                {resendLoading ? t("loading") : t("clickHereToResend")}
              </Button>
            </p>
          )}
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">
              {t("backToLogin")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
