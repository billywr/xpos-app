/**
 * Centralized Sentence Case Utility
 *
 * Enforces system-wide Sentence case naming conventions (capitalizing only the first
 * word and proper nouns/acronyms), while preserving currencies, brand names, and abbreviations.
 */

// Normalized map: lowercase key -> exact canonical casing
const PROPER_NOUNS: Record<string, string> = {
  // Currencies & units
  ksh: "KSh",
  kes: "KES",
  usd: "USD",
  eur: "EUR",
  gbp: "GBP",
  ugx: "UGX",
  tzs: "TZS",
  kg: "kg",
  g: "g",
  mg: "mg",
  l: "L",
  ml: "ml",
  pcs: "pcs",
  pg: "pg",

  // Brands & system proper nouns
  xpos: "XPOS",
  mpesa: "M-Pesa",
  "m-pesa": "M-Pesa",
  keycloak: "Keycloak",
  postgresql: "PostgreSQL",
  postgres: "PostgreSQL",
  docker: "Docker",
  android: "Android",
  ios: "iOS",

  // Business & technical acronyms
  sku: "SKU",
  pin: "PIN",
  id: "ID",
  vat: "VAT",
  "e-tims": "E-TIMS",
  etims: "eTIMS",
  pos: "POS",
  pdf: "PDF",
  csv: "CSV",
  sms: "SMS",
  url: "URL",
  api: "API",
  "p&l": "P&L",
  qr: "QR",
  "z-report": "Z-Report",
  "z-reports": "Z-Reports",
  ok: "OK",
  tv: "TV",
  "wi-fi": "Wi-Fi",
  wifi: "Wi-Fi",
  ip: "IP",
  mac: "MAC",
  tz: "TZ",
  uom: "UOM",
  cogs: "COGS",
  kpi: "KPI",
  kpis: "KPIs",
  grn: "GRN",
  llm: "LLM",
  ai: "AI",
};

/**
 * Checks if a string matches an acronym or proper noun.
 */
function getProperNounReplacement(token: string): string | null {
  const clean = token.toLowerCase();
  return PROPER_NOUNS[clean] ?? null;
}

/**
 * Formats a single word or token according to sentence-case rules.
 *
 * @param token The word to format (may contain leading/trailing punctuation).
 * @param isFirstWord Whether this word is the first word of a sentence or clause.
 */
function formatToken(token: string, isFirstWord: boolean): string {
  if (!token) return token;

  // Handle parenthesized tokens like (KSH) -> (KSh)
  const parenMatch = token.match(/^(\()([^)]+)(\))$/);
  if (parenMatch) {
    const [, open, inner, close] = parenMatch;
    const replacement = getProperNounReplacement(inner);
    if (replacement) {
      return `${open}${replacement}${close}`;
    }
    const formattedInner = isFirstWord
      ? inner.charAt(0).toUpperCase() + inner.slice(1).toLowerCase()
      : inner.toLowerCase();
    return `${open}${formattedInner}${close}`;
  }

  // Handle trailing punctuation like "No." or "ID:" or "Amount,"
  const punctMatch = token.match(/^([^a-zA-Z0-9]*)([a-zA-Z0-9&'-]+)([^a-zA-Z0-9]*)$/);
  if (punctMatch) {
    const [, leading, word, trailing] = punctMatch;

    // Special check for "No." abbreviation
    if (word.toLowerCase() === "no" && trailing.startsWith(".")) {
      return `${leading}No.${trailing.slice(1)}`;
    }

    const replacement = getProperNounReplacement(word);

    if (replacement) {
      return `${leading}${replacement}${trailing}`;
    }

    if (isFirstWord) {
      const cased = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      return `${leading}${cased}${trailing}`;
    }

    return `${leading}${word.toLowerCase()}${trailing}`;
  }

  // Fallback
  const replacement = getProperNounReplacement(token);
  if (replacement) return replacement;

  if (isFirstWord) {
    return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
  }
  return token.toLowerCase();
}

/**
 * Converts a string to Sentence case.
 * - Capitalizes the first letter of the first word (and after sentence-ending punctuation).
 * - Converts non-proper-noun words to lowercase.
 * - Preserves known proper nouns, acronyms, and units (e.g. KSh, M-Pesa, SKU, PIN, VAT, POS, ID, P&L, etc.).
 * - Replaces underscores in SCREAMING_SNAKE_CASE (e.g. IN_PROGRESS -> In progress).
 *
 * @example
 * toSentenceCase("CUSTOMER NAME") // "Customer name"
 * toSentenceCase("TOTAL AMOUNT (KSH)") // "Total amount (KSh)"
 * toSentenceCase("REVENUE & P&L") // "Revenue & P&L"
 * toSentenceCase("ACTIVE") // "Active"
 */
export function toSentenceCase(text: string | null | undefined): string {
  if (!text) return "";
  if (typeof text !== "string") return String(text);

  const trimmed = text.trim();
  if (!trimmed) return text;

  // Convert SCREAMING_SNAKE_CASE if whole string matches
  const isScreamingSnake = /^[A-Z0-9]+(_[A-Z0-9]+)+$/.test(trimmed);
  const normalized = isScreamingSnake ? trimmed.replace(/_/g, " ") : trimmed;

  // Split tokens while preserving whitespace delimiters
  const tokens = normalized.split(/(\s+)/);

  let isFirstWordInClause = true;
  const result: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Preserve whitespace as-is
    if (/^\s+$/.test(token)) {
      result.push(token);
      continue;
    }

    // Check if token ends with sentence terminator (. ! ?) or clause break (: ; /)
    const formatted = formatToken(token, isFirstWordInClause);
    result.push(formatted);

    // If token ends with sentence-terminating punctuation (excluding abbreviations like No.), next word is first word
    const isAbbr = /^no\.$/i.test(token);
    if (!isAbbr && /[.!?:]$/.test(token)) {
      isFirstWordInClause = true;
    } else {
      isFirstWordInClause = false;
    }
  }

  return result.join("");
}
