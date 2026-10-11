// The verified HelloFresh alumni board was initially imported under its
// opaque Greenhouse token. Keep old records readable until their next sync.
export function readableCompanyName(name: string): string {
  return name === "4lu44n1n37w012k" ? "HelloFresh" : name;
}
