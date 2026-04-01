/**
 * Kölner Phonetik – German phonetic algorithm.
 * Converts a string to a phonetic code so that similarly-sounding words
 * (including common German spelling mistakes) map to the same code.
 *
 * Reference: https://de.wikipedia.org/wiki/Kölner_Phonetik
 */
function kölnerPhonetik(input: string): string {
  if (!input) return "";

  const s = input
    .toUpperCase()
    .replace(/Ä/g, "AE")
    .replace(/Ö/g, "OE")
    .replace(/Ü/g, "UE")
    .replace(/ß/g, "SS")
    .replace(/[^A-Z]/g, "");

  if (!s) return "";

  let code = "";

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const prev = i > 0 ? s[i - 1] : "";
    const next = i < s.length - 1 ? s[i + 1] : "";

    let digit: string;

    switch (ch) {
      case "A":
      case "E":
      case "I":
      case "J":
      case "O":
      case "U":
      case "Y":
        digit = "0";
        break;
      case "H":
        digit = "";
        break;
      case "B":
        digit = "1";
        break;
      case "P":
        digit = next === "H" ? "3" : "1";
        break;
      case "D":
      case "T":
        digit = /[CSZ]/.test(next) ? "8" : "2";
        break;
      case "F":
      case "V":
      case "W":
        digit = "3";
        break;
      case "G":
      case "K":
      case "Q":
        digit = "4";
        break;
      case "C":
        if (i === 0) {
          digit = /[AHKLOQRUX]/.test(next) ? "4" : "8";
        } else if (/[SZ]/.test(prev)) {
          digit = "8";
        } else if (/[AHKOQUX]/.test(next)) {
          digit = "4";
        } else if (/[EIY]/.test(next)) {
          digit = "8";
        } else {
          digit = "4";
        }
        break;
      case "X":
        digit = /[CKQ]/.test(prev) ? "8" : "48";
        break;
      case "L":
        digit = "5";
        break;
      case "M":
      case "N":
        digit = "6";
        break;
      case "R":
        digit = "7";
        break;
      case "S":
      case "Z":
        digit = "8";
        break;
      default:
        digit = "";
    }

    code += digit;
  }

  // Remove consecutive duplicates
  code = code.replace(/(.)\1+/g, "$1");

  // Remove zeros except at the very start
  if (code.length > 1) {
    code = code[0] + code.slice(1).replace(/0/g, "");
  }

  return code;
}

/**
 * Returns true if `query` phonetically matches any of the given `fields`.
 *
 * - First tries a fast direct substring match.
 * - Falls back to Kölner Phonetik token-level comparison.
 *
 * Each token of the query must match at least one token in one of the fields.
 */
export function matchesSearch(
  query: string,
  ...fields: (string | null | undefined)[]
): boolean {
  if (!query.trim()) return true;

  const queryTokens = query.trim().split(/\s+/);

  return queryTokens.every((token) => {
    const t = token.toLowerCase();
    const tCode = kölnerPhonetik(token);

    return fields.some((field) => {
      if (!field) return false;
      const f = field.toLowerCase();

      // 1. Fast path: direct substring match
      if (f.includes(t)) return true;

      // 2. Phonetic match: compare each word in the field
      if (tCode) {
        return field.split(/\s+/).some((word) => {
          const wCode = kölnerPhonetik(word);
          // startsWith handles partial queries like "Mül" → "Müller"
          return wCode && (wCode.startsWith(tCode) || tCode.startsWith(wCode));
        });
      }

      return false;
    });
  });
}
