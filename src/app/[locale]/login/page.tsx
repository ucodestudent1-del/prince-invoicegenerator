"use client";

import * as React from "react";
import { useRouter, getPathnameWithLocale } from "@/i18n/navigation";
import { useLocaleSafe } from "@/hooks/use-locale-safe";
import { signIn } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";
import { APP_NAME } from "@/lib/app-name";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const locale = useLocaleSafe();
  const [loading, setLoading] = React["useState"](false);
  const [error, setError] = React["useState"]<string | null>(null);
  const [email, setEmail] = React["useState"]("");
  const [password, setPassword] = React["useState"]("");

  async function googleLogin() {
    setLoading(true);
    setError(null);
    try {
      await signIn("google", { callbackUrl: getPathnameWithLocale({ href: "/dashboard", locale }) });
    } catch (err: any) {
      setError(err?.["message"] || t("googleSignInFailed"));
      setLoading(false);
    }
  }

  async function emailLogin(e: React.FormEvent<HTMLFormElement>) {
    e["preventDefault"]();
    setLoading(true);
    setError(null);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.["error"]) {
        setError(t("invalidCredentials"));
      } else {
        router["push"](getPathnameWithLocale({ href: "/dashboard", locale }));
        router["refresh"]();
      }
    } catch (err: any) {
      setError(err?.["message"] || t("signInFailed"));
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
              <HardHat className="h-5 w-5" />
            </span>
            {APP_NAME}
          </Link>
          <CardTitle>{t("signInTitle")}</CardTitle>
          <CardDescription>{t("signInDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <form onSubmit={emailLogin} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e["target"]["value"])}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e["target"]["value"])}
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300" />
                <span>{t("rememberMe")}</span>
              </label>
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                {t("forgotPassword")}
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("signingIn") : t("signIn")}
            </Button>
          </form>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">{t("orContinueWith")}</span>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={googleLogin} disabled={loading}>
            {t("googleButton")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link href="/signup" className="text-primary hover:underline">
              {t("signUp")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}