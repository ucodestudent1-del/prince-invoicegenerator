-- Add MagicLink model for passwordless authentication

CREATE TABLE IF NOT EXISTS "MagicLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "expires" TIMESTAMP WITH TIME ZONE NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "MagicLink_identifier_idx" ON "MagicLink" ("identifier");
CREATE INDEX IF NOT EXISTS "MagicLink_token_idx" ON "MagicLink" ("token");
