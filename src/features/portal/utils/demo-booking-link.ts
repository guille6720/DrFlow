export function demoBookingLink(slug: string, receipt: string) {
  return `${window.location.origin}/portal/${encodeURIComponent(slug)}#turno=${encodeURIComponent(receipt)}`;
}

export function readDemoBookingLink(value: string): string {
  const fragment = value.trim().split("#")[1] ?? "";
  return new URLSearchParams(fragment).get("turno") ?? "";
}
