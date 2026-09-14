export interface NormalizedAddress {
  line1: string;
  line2: string;
}

export class AddressNormalizer {
  static readonly SECONDARY_DESIGNATORS = ['apt', 'apartment', 'unit', 'suite', 'ste', '#'];

  static normalize(rawAddress: unknown): NormalizedAddress {
    if (typeof rawAddress !== 'string' || !rawAddress.trim()) {
      return { line1: '', line2: '' };
    }

    const clean = this.preprocess(rawAddress);

    if (clean.includes('\n')) {
      const parts = clean
        .split('\n')
        .map((part) => part.trim())
        .filter(Boolean);
      return { line1: parts[0] ?? '', line2: parts[1] ?? '' };
    }

    if (clean.includes('-')) {
      const dashParsed = this.parseDashSeparated(clean);
      if (dashParsed) return dashParsed;
    }

    const suffixMatch = clean.match(/^(\d+)\s*(½|[A-Za-z])\b\s+(.*)/i);
    if (suffixMatch) {
      return this.parseCivicSuffixAddress(suffixMatch);
    }

    return this.parseInlineUnit(clean);
  }

  private static preprocess(rawAddress: string): string {
    return rawAddress
      .trim()
      .split('\n')
      .map((line) => line.trim().replace(/\s+/g, ' '))
      .join('\n')
      .replace(/\b1\/2\b/g, '½')
      .replace(/([a-z0-9])(Apt|Unit|Ste|Suite|#)/gi, '$1 $2')
      .replace(/\b(Apt|Unit|Ste|Suite|#)\.?\s*(?=\d)/gi, '$1 ')
      .replace(/\bSt\.?(?=\s|$)/gi, 'Street')
      .replace(/\bAve\.?(?=\s|$)/gi, 'Avenue')
      .replace(/\bRd\.?(?=\s|$)/gi, 'Road')
      .replace(/\bDr\.?(?=\s|$)/gi, 'Drive')
      .replace(/\bBlvd\.?(?=\s|$)/gi, 'Boulevard');
  }

  private static parseDashSeparated(clean: string): NormalizedAddress | null {
    const numericUnitMatch = clean.match(
      /^(?:(unit|apt|suite|ste|#)\s*)?(\d+[a-z]?)\s*-\s*(\d+\s+.*)$/i,
    );
    if (numericUnitMatch) {
      const rawUnit = numericUnitMatch[2]!.trim();
      const streetPart = numericUnitMatch[3]!.trim();
      const formattedUnit = this.hasSecondaryPrefix(rawUnit) ? rawUnit : `Unit ${rawUnit}`;
      return { line1: streetPart, line2: formattedUnit };
    }

    const prefixSuffixMatch = clean.match(
      /^(?:([a-z]|½)\s*-\s*(\d+)|(\d+)\s*-\s*([a-z]|½))\s+(.*)$/i,
    );
    if (prefixSuffixMatch) {
      const civicNum = prefixSuffixMatch[2] ?? prefixSuffixMatch[3]!;
      const suffix = (prefixSuffixMatch[1] ?? prefixSuffixMatch[4]!).toUpperCase();
      const street = prefixSuffixMatch[5]!.trim();
      const formattedSuffix = suffix === '½' ? ' ½' : suffix;
      return { line1: `${civicNum}${formattedSuffix} ${street}`.trim(), line2: '' };
    }

    if (/\s+-\s+/.test(clean)) {
      const parts = clean.split(/\s+-\s+/).map((part) => part.trim());
      const streetPart = parts[0] ?? '';
      const unitOrSuffix = parts[1] ?? '';

      if (/^[A-Za-z]$/.test(unitOrSuffix) || unitOrSuffix === '½') {
        const suffix = unitOrSuffix === '½' ? ' ½' : unitOrSuffix.toUpperCase();
        return {
          line1: streetPart.replace(/^(\d+)/, `$1${suffix}`),
          line2: '',
        };
      }

      const formattedUnit = this.hasSecondaryPrefix(unitOrSuffix)
        ? unitOrSuffix
        : `Unit ${unitOrSuffix}`;
      return { line1: streetPart, line2: formattedUnit };
    }

    return null;
  }

  private static parseCivicSuffixAddress(match: RegExpMatchArray): NormalizedAddress {
    const civicNum = match[1]!;
    const suffix = match[2]!.toUpperCase() === '½' ? ' ½' : match[2]!.toUpperCase();
    const restOfAddress = match[3]!;
    const designatorPattern = this.SECONDARY_DESIGNATORS.join('|');
    const inlineMatch = restOfAddress.match(
      new RegExp(`^(.*?)\\s*[, ]\\s*(${designatorPattern})\\b\\s*(.*)`, 'i'),
    );

    if (inlineMatch) {
      return {
        line1: `${civicNum}${suffix} ${inlineMatch[1]}`.trim(),
        line2: `${inlineMatch[2]} ${inlineMatch[3]}`.trim(),
      };
    }

    return { line1: `${civicNum}${suffix} ${restOfAddress}`.trim(), line2: '' };
  }

  private static parseInlineUnit(clean: string): NormalizedAddress {
    const designatorPattern = this.SECONDARY_DESIGNATORS.join('|');
    const match = clean.match(
      new RegExp(`^(.*?)\\s*[, ]\\s*(${designatorPattern})\\b\\s*(.*)`, 'i'),
    );

    if (match) {
      return {
        line1: match[1]!.trim(),
        line2: `${match[2]!.trim()} ${match[3]!.trim()}`.trim(),
      };
    }

    return { line1: clean, line2: '' };
  }

  private static hasSecondaryPrefix(value: string): boolean {
    const designatorPattern = this.SECONDARY_DESIGNATORS.join('|');
    return new RegExp(`^(${designatorPattern})`, 'i').test(value);
  }
}
