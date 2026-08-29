"use client";

import * as React from "react";
import { useRouter, getPathnameWithLocale } from "@/i18n/navigation";
import { useLocaleSafe } from "@/hooks/use-locale-safe";
import { signIn } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";
import { APP_NAME } from "@/lib/app-name";
import { signup } from "@/lib/actions/auth";
import { getPasswordStrength } from "@/lib/password-strength";

export default function SignupPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const locale = useLocaleSafe();
  const [loading, setLoading] = React["useState"](false);
  const [error, setError] = React["useState"]<string | null>(null);
  const [password, setPassword] = React["useState"]("");
  const [terms, setTerms] = React["useState"](false);
  const [marketing, setMarketing] = React["useState"](false);

  const strength = getPasswordStrength(password);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e["preventDefault"]();
    setLoading(true);
    setError(null);

    const fd = new FormData(e["currentTarget"]);
    const name = String(fd["get"]("name") || "")["trim"]();
    const email = String(fd["get"]("email") || "")["trim"]();
    const passwordValue = String(fd["get"]("password") || "");

    if (!terms) {
      setError("You must accept the terms and conditions.");
      setLoading(false);
      return;
    }

    try {
      const result = await signup({
        email,
        password: passwordValue,
        name,
        terms,
        marketing,
      });

      if (result["success"]) {
        const signInResult = await signIn("credentials", {
          email,
          password: passwordValue,
          redirect: false,
        });
        if (signInResult?.error) {
          setError(t("invalidCredentials"));
          setLoading(false);
          return;
        }
        router["push"](getPathnameWithLocale({ href: "/verify-email?sent=1", locale }));
      }
    } catch (err: any) {
      setError(err?.["message"] || t("unexpectedError"));
    } finally {
      setLoading(false);
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
          <CardTitle>{t("signUpTitle")}</CardTitle>
          <CardDescription>{t("signUpDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="name">{t("fullName")} *</Label>
              <Input id="name" name="name" required autoFocus />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">{t("email")} *</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">{t("password")} *</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e["target"]["value"])}
              />
              {password && (
                <div className="mt-1">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${strength["score"] * 25}%`,
                          backgroundColor: strength["color"],
                        }}
                      />
                    </div>
                    <span className="text-xs" style={{ color: strength["color"] }}>
                      {strength["label"]}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="terms"
                name="terms"
                checked={terms}
                onChange={(e) => setTerms(e["target"]["checked"])}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                required
              />
              <Label htmlFor="terms" className="text-sm font-normal">
                {t("acceptTerms")}{" "}
                <Link href="/terms" className="text-primary hover:underline">
                  {t("termsOfService")}
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-primary hover:underline">
                  {t("privacyPolicy")}
                </Link>
                .
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="marketing"
                name="marketing"
                checked={marketing}
                onChange={(e) => setMarketing(e["target"]["checked"])}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="marketing" className="text-sm font-normal">
                {t("marketingConsent")}
              </Label>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("creatingAccount") : t("createAccount")}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("alreadyHaveAccount")}{" "}
            <Link href="/login" className="text-primary hover:underline">
              {t("signIn")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
