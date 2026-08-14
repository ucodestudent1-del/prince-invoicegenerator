import { logError } from "@/lib/logging";

export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

export function actionError(message: string): never {
  throw new ActionError(message);
}

export async function withActionError<T>(
  context: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (err?.digest === "NEXT_REDIRECT" || err?.digest === "NEXT_NOT_FOUND") {
      throw err;
    }
    if (err instanceof ActionError) {
      throw err;
    }
    logError(context, err);
    const message =
      err instanceof Error && err.message
        ? `Unexpected error: ${err.message}`
        : "An unexpected error occurred. Please try again.";
    throw new ActionError(message);
  }
}
