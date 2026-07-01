/**
 * Fill-in-blank placeholder width heuristic for print/preview.
 *
 * Requirement:
 * - Vietnamese alphabet (Unicode Script=Latin) => x4 per character
 * - Japanese/Chinese => x6 per character (Script=Han/Hiragana/Katakana)
 * - Other characters default to x6 (e.g. emoji/symbol)
 * - Apply `min 4` placeholder characters.
 *
 * Note:
 * - We count per code point (using `for...of`) to avoid surrogate pair issues.
 * - Combining marks are treated as "alpha width" (unit=1) so we don't inflate for diacritics.
 */

const reCombiningMark = /\p{Mark}/u
const reHan = /\p{Script=Han}/u
const reHiragana = /\p{Script=Hiragana}/u
const reKatakana = /\p{Script=Katakana}/u
const reLatin = /\p{Script=Latin}/u
const reDigit = /\p{Nd}/u
const rePunctuation = /\p{P}/u

function getCharUnit(ch: string): number {
  // Whitespace: keep it small; print placeholders use their own spacing anyway.
  if (/\s/u.test(ch)) return 1

  // Combining marks (diacritics) should not blow up placeholder length.
  if (reCombiningMark.test(ch)) return 1

  // Japanese/Chinese (mainly ideographs + syllabaries)
  if (reHan.test(ch) || reHiragana.test(ch) || reKatakana.test(ch)) return 6

  // Vietnamese alphabet / Latin letters
  if (reLatin.test(ch)) return 4

  // Numbers & punctuation are treated like alphabet (avoid huge jumps)
  if (reDigit.test(ch) || rePunctuation.test(ch)) return 4

  // Emoji / symbols / everything else
  return 6
}

export function getFillInBlankPlaceholderCount(text: string): number {
  let totalUnits = 0
  for (const ch of text) {
    totalUnits += getCharUnit(ch)
  }

  // `min 4` placeholders (spaces/dots) even when answer is empty.
  return Math.max(4, Math.ceil(totalUnits))
}
