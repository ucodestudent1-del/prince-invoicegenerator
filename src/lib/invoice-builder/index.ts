// Server-safe surface.
// These modules are pure TypeScript with no React hooks, so they can be
// imported by API routes and Server Components without pulling client-only
// code into the server bundle.
export * from "./document-model";
export * from "./component-registry";
export * from "./document-operations";
export * from "./icon-registry";
export * from "./legacy-integration";