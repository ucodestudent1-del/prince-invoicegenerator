export function logError(context: string, err: unknown) {
  const message = err instanceof Error ? err["message"] : String(err);
  const stack = err instanceof Error ? err["stack"] : undefined;
  console["error"](`[${context}] ${message}`, stack ? `\n${stack}` : "");
}

export function logInfo(context: string, message: string) {
  console["info"](`[${context}] ${message}`);
}