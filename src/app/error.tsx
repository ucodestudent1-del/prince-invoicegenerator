"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred while loading this page.
        </p>
        {error.digest && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm font-mono text-destructive">
              Error ID: {error.digest}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Search your server logs for this digest to find the full error details.
            </p>
          </div>
        )}
        {process.env.NODE_ENV === "development" && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm font-mono text-destructive">{error.message}</p>
            {error.stack && (
              <pre className="mt-2 overflow-auto text-xs text-destructive">
                {error.stack}
              </pre>
            )}
          </div>
        )}
        <button
          onClick={reset}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
