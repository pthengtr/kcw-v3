// productskuform/barcode-utils.ts
export function normalizeDigits(input: string): string {
  return (input ?? "").replace(/[\s-]+/g, "").trim();
}

function computeGtinCheckDigit(digitsWithoutCheck: string): number {
  // Mod-10 (GS1): multiply alternating weights 3/1 from rightmost moving left (excluding check digit)
  // Implementation: sum of digits * 3 for odd positions from right (1-based), * 1 for even positions.
  let sum = 0;
  const n = digitsWithoutCheck.length;
  for (let i = 0; i < n; i++) {
    const char = digitsWithoutCheck.charCodeAt(n - 1 - i) - 48; // last to first
    if (char < 0 || char > 9) return -1;
    const weight = i % 2 === 0 ? 3 : 1;
    sum += char * weight;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

export function isValidGtin(raw: string): boolean {
  const s = normalizeDigits(raw);
  if (!/^\d+$/.test(s)) return false;
  if (![8, 12, 13, 14].includes(s.length)) return false;
  const body = s.slice(0, -1);
  const check = s.slice(-1);
  const cd = computeGtinCheckDigit(body);
  if (cd < 0) return false;
  return String(cd) === check;
}

export function gtinType(
  raw: string
): "GTIN-8" | "GTIN-12" | "GTIN-13" | "GTIN-14" | null {
  const s = normalizeDigits(raw);
  if (!/^\d+$/.test(s)) return null;
  switch (s.length) {
    case 8:
      return "GTIN-8";
    case 12:
      return "GTIN-12";
    case 13:
      return "GTIN-13";
    case 14:
      return "GTIN-14";
    default:
      return null;
  }
}
