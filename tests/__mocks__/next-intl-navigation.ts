export function createNavigation() {
  return {
    Link: () => null,
    redirect: () => {},
    usePathname: () => "/",
    useRouter: () => ({}),
    getPathname: (p) => (typeof p === "string" ? p : "/"),
  };
}
