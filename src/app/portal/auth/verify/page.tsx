"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { verifyPortalToken } from "@/lib/actions/portal";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function PortalVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Invalid or missing token.");
      return;
    }

    const verify = async () => {
      try {
        const result = await verifyPortalToken(token);
        if (result) {
          // Store token in cookie
          document.cookie = `portal_token=${result.token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
          setStatus("success");
          // Redirect to dashboard after short delay
          setTimeout(() => {
            router.push("/portal/dashboard");
          }, 2000);
        } else {
          setStatus("error");
          setErrorMessage("Invalid or expired token.");
        }
      } catch (err: any) {
        setStatus("error");
        setErrorMessage(err.message || "Verification failed.");
      }
    };

    verify();
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>
            {status === "loading" && "Verifying your login..."}
            {status === "success" && "Login Successful!"}
            {status === "error" && "Login Failed"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4">
            {status === "loading" && <Loader2 className="h-12 w-12 animate-spin text-primary" />}
            {status === "success" && <CheckCircle className="h-12 w-12 text-green-500" />}
            {status === "error" && <XCircle className="h-12 w-12 text-red-500" />}

            {status === "loading" && (
              <p className="text-muted-foreground">Please wait while we verify your login link.</p>
            )}
            {status === "success" && (
              <div>
                <p className="text-green-600 font-medium">You are now signed in.</p>
                <p className="text-sm text-muted-foreground mt-1">Redirecting to your dashboard...</p>
              </div>
            )}
            {status === "error" && (
              <div>
                <p className="text-red-600">{errorMessage}</p>
                <Button asChild variant="outline" className="mt-4">
                  <a href="/portal/auth">Try Again</a>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
