/**
 * Lightweight near-duplicate detection for scenario text (no external dependencies).
 * Uses Jaccard similarity over normalised word bigrams + unigrams.
 */

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'for', 'with', 'without', 'at', 'by',
  'from', 'is', 'are', 'was', 'were', 'be', 'it', 'its', 'their', 'they', 'them', 'his', 'her', 'he',
  'she', 'that', 'this', 'as', 'so', 'into', 'about', 'after', 'before', 'who', 'which', 'has', 'have',
]);

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(' ')
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function features(text: string): Set<string> {
  const tokens = tokenize(text);
  const set = new Set<string>(tokens);
  for (let i = 0; i < tokens.length - 1; i++) set.add(`${tokens[i]}_${tokens[i + 1]}`);
  return set;
}

export function jaccardSimilarity(a: string, b: string): number {
  const fa = features(a);
  const fb = features(b);
  if (fa.size === 0 && fb.size === 0) return 1;
  let intersection = 0;
  for (const f of fa) if (fb.has(f)) intersection++;
  const union = fa.size + fb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export const NEAR_DUPLICATE_THRESHOLD = 0.55;

export function isNearDuplicate(a: string, b: string, threshold = NEAR_DUPLICATE_THRESHOLD): boolean {
  if (normalizeText(a) === normalizeText(b)) return true;
  return jaccardSimilarity(a, b) >= threshold;
}

/**
 * Removes duplicates from `candidates`, both against `existing` texts and within the batch itself.
 */
export function dedupeAgainst<T>(
  candidates: readonly T[],
  existing: readonly string[],
  getText: (item: T) => string,
  threshold = NEAR_DUPLICATE_THRESHOLD,
): { unique: T[]; duplicates: T[] } {
  const accepted: string[] = [...existing];
  const unique: T[] = [];
  const duplicates: T[] = [];
  for (const c of candidates) {
    const text = getText(c);
    if (accepted.some((e) => isNearDuplicate(text, e, threshold))) duplicates.push(c);
    else {
      unique.push(c);
      accepted.push(text);
    }
  }
  return { unique, duplicates };
}
