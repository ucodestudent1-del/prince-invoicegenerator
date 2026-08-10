"use client";

import * as React from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { signIn } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { APP_NAME } from "@/lib/app-name";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split("/")[1] || "en";
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function devLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await signIn("credentials", {
        email,
        name,
        redirect: false,
      });
      if (res?.ok) {
        router.push("/dashboard");
      } else {
        setError(res?.error || t("signInFailed"));
      }
    } catch (err: any) {
      setError(err?.message || t("unexpectedError"));
    } finally {
      setLoading(false);
    }
  }

  async function googleLogin() {
    setError(null);
    try {
      await signIn("google", { callbackUrl: `/${locale}/dashboard` });
    } catch (err: any) {
      setError(err?.message || t("googleSignInFailed"));
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
          <CardDescription>
            {t("signInSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <form onSubmit={devLogin} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email">{t("emailLabel")}</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="name">{t("nameLabel")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("signingIn") : t("continueButton")}
            </Button>
          </form>

          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={googleLogin}
            >
              {t("googleButton")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
