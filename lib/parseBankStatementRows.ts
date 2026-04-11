export type ParsedTransactionBlock = {
  date: string;
  description: string;
  rawDescription: string;
  amount: number;
  type: 'income' | 'expense';
  balance: number | null;
};

const FLEXIBLE_NUMERIC_DATE = String.raw`\d{1,2}\s*[-/]\s*\d{1,2}\s*[-/]\s*\d{2,4}`;
const FLEXIBLE_ISO_DATE = String.raw`\d{4}\s*[-/]\s*\d{1,2}\s*[-/]\s*\d{1,2}`;
const FLEXIBLE_MONTH_DATE = String.raw`\d{1,2}\s*[-/\s]\s*[A-Za-z]{3,9}\s*[-/\s]\s*\d{2,4}`;
const FLEXIBLE_DATE = `(?:${FLEXIBLE_NUMERIC_DATE}|${FLEXIBLE_ISO_DATE}|${FLEXIBLE_MONTH_DATE})`;
const DATE_AT_LINE_START = new RegExp(`^\\s*(?<date>${FLEXIBLE_DATE})`, 'i');
const DATE_ANYWHERE = new RegExp(FLEXIBLE_DATE, 'gi');

// Keep amounts flexible enough for bank PDFs: commas, spaces, prefixes, and trailing signs.
const AMOUNT_TOKEN =
  /(?:^|[^\dA-Za-z])((?:(?:CR|DR)\s*)?[-+]?\s*(?:\d{1,3}(?:[,\s]\d{2,3})+|\d+)\.\d{1,2}\s*(?:(?:CR|DR)|[+-])?)(?=$|[^\dA-Za-z])/gi;

export const parseBankStatementRows = (pageTexts: string[]): ParsedTransactionBlock[] => {
  console.log('--- STARTING GENERIC BLOCK PARSING ---');

  const lines = pageTexts.flatMap((pageText) =>
    pageText
      .split(/\r?\n/)
      .flatMap(splitPotentialTransactionLines)
      .map((line) => line.trim())
  );

  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  for (const line of lines) {
    console.log('LINE:', line);
    if (shouldIgnoreLine(line)) continue;

    if (DATE_AT_LINE_START.test(line)) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
      }
      currentBlock = [line];
    } else if (currentBlock.length > 0) {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  const rows: ParsedTransactionBlock[] = [];
  let prevBalance: number | null = null;

  for (const block of blocks) {
    const parsedRow = parseTransactionBlock(block, prevBalance);
    console.log('PARSED:', parsedRow);

    if (parsedRow) {
      rows.push(parsedRow);
      prevBalance = parsedRow.balance;
    }
  }

  console.log('Parsed Transactions:', rows);
  return rows;
};

const splitPotentialTransactionLines = (line: string): string[] => {
  DATE_ANYWHERE.lastIndex = 0;
  const dateMatches = Array.from(line.matchAll(DATE_ANYWHERE));

  if (dateMatches.length <= 1) {
    return [line];
  }

  const segments: string[] = [];
  let segmentStart = 0;

  for (let index = 1; index < dateMatches.length; index += 1) {
    const nextDateIndex = dateMatches[index].index ?? 0;
    const candidateSegment = line.slice(segmentStart, nextDateIndex).trim();

    if (hasAmountToken(candidateSegment)) {
      segments.push(candidateSegment);
      segmentStart = nextDateIndex;
    }
  }

  segments.push(line.slice(segmentStart).trim());
  return segments.filter((segment) => segment.length > 0);
};

const parseTransactionBlock = (
  block: string[],
  prevBalance: number | null
): ParsedTransactionBlock | null => {
  const fullBlockText = block.join(' ').replace(/\s+/g, ' ').trim();

  const dateMatch = fullBlockText.match(DATE_AT_LINE_START);
  const parsedDate = dateMatch?.groups?.date
    ? parseDateString(dateMatch.groups.date)
    : null;

  let remainder = dateMatch ? fullBlockText.slice(dateMatch[0].length).trim() : fullBlockText;

  const secondaryDateMatch = remainder.match(new RegExp(`^${FLEXIBLE_DATE}\\s+`, 'i'));
  if (secondaryDateMatch) {
    remainder = remainder.slice(secondaryDateMatch[0].length).trim();
  }

  AMOUNT_TOKEN.lastIndex = 0;
  const amountMatches = Array.from(remainder.matchAll(AMOUNT_TOKEN));
  const amountTokens = amountMatches.map((match) => (match[1] ?? match[0]).trim());

  let description = remainder;
  for (const token of amountTokens) {
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    description = description.replace(new RegExp(escapedToken, 'g'), ' ');
  }

  description = description
    .replace(/\s+/g, ' ')
    .replace(/^[-,.\s]+/, '')
    .trim();

  if (!description || description.length < 2) {
    description = 'Transaction';
  }

  const rawDescription = description;
  const cleanedDescription = cleanDescription(description);

  if (amountTokens.length === 0) {
    return null;
  }

  const numericValues = amountTokens
    .map((token) => {
      const cleaned = normalizeSignedAmount(token);
      return { val: parseFloat(cleaned) };
    })
    .filter((value) => !isNaN(value.val));

  if (numericValues.length === 0) {
    return null;
  }

  let amount = 0;
  let balance: number | undefined;
  let numericAmount = 0;

  if (numericValues.length === 1) {
    numericAmount = numericValues[0].val;
    amount = Math.abs(numericAmount);
  } else if (numericValues.length === 2) {
    numericAmount = numericValues[0].val;
    amount = Math.abs(numericAmount);
    balance = numericValues[1].val;
  } else if (numericValues.length >= 3) {
    const secondLast = numericValues[numericValues.length - 2];
    const last = numericValues[numericValues.length - 1];

    numericAmount = secondLast.val;
    amount = Math.abs(numericAmount);
    balance = last.val;
  }

  if (isNaN(amount) || amount === 0) {
    return null;
  }

  const transactionDate = parsedDate ?? new Date();
  const currentBalance = normalizeNumber(balance);
  let type: 'income' | 'expense' = 'expense';

  if (prevBalance !== null && currentBalance !== null) {
    if (currentBalance > prevBalance) {
      type = 'income';
    } else if (currentBalance < prevBalance) {
      type = 'expense';
    }
  }

  console.log('PREV:', prevBalance, 'CURR:', currentBalance, 'TYPE:', type);

  return {
    date: transactionDate.toISOString(),
    description: cleanedDescription,
    rawDescription,
    amount,
    type,
    balance: currentBalance
  };
};

const hasAmountToken = (value: string) => {
  AMOUNT_TOKEN.lastIndex = 0;
  return AMOUNT_TOKEN.test(value);
};

const normalizeSignedAmount = (amount: string) => {
  const trimmedAmount = amount.trim();
  const hasTrailingMinus = /-\s*$/.test(trimmedAmount);
  const hasTrailingPlus = /\+\s*$/.test(trimmedAmount);
  const normalizedAmount = trimmedAmount.replace(/[^0-9.-]/g, '');

  if (hasTrailingMinus && !normalizedAmount.startsWith('-')) {
    return `-${normalizedAmount.replace(/-/g, '')}`;
  }

  if (hasTrailingPlus) {
    return normalizedAmount.replace(/\+/g, '');
  }

  return normalizedAmount;
};

const normalizeNumber = (val: number | string | null | undefined) => {
  if (val === null || val === undefined || val === '') {
    return null;
  }

  if (typeof val === 'number') {
    return Number.isNaN(val) ? null : val;
  }

  const parsedValue = parseFloat(val.replace(/[₹,]/g, ''));
  return Number.isNaN(parsedValue) ? null : parsedValue;
};

const parseDateString = (value: string): Date | null => {
  const trimmedValue = value.replace(/\s+/g, ' ').trim();
  const compactDate = trimmedValue.replace(/\s*[-/]\s*/g, '-');
  const parts = compactDate.split(/[-\s]+/).filter(Boolean);

  if (parts.length !== 3) {
    const fallback = new Date(trimmedValue);
    return isNaN(fallback.getTime()) ? null : fallback;
  }

  let day = 0;
  let month = 0;
  let year = 0;

  if (/^\d{4}$/.test(parts[0])) {
    year = Number(parts[0]);
    month = parseMonth(parts[1]);
    day = Number(parts[2]);
  } else if (/[a-z]/i.test(parts[1])) {
    day = Number(parts[0]);
    month = parseMonth(parts[1]);
    year = normalizeYear(parts[2]);
  } else {
    day = Number(parts[0]);
    month = parseMonth(parts[1]);
    year = normalizeYear(parts[2]);
  }

  if (!day || !month || !year) {
    return null;
  }

  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  return isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const parseMonth = (value: string) => {
  const numericMonth = Number(value);

  if (!isNaN(numericMonth)) {
    return numericMonth;
  }

  const monthIndex = [
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec'
  ].findIndex((month) => value.toLowerCase().startsWith(month));

  return monthIndex === -1 ? 0 : monthIndex + 1;
};

const normalizeYear = (value: string) => {
  const year = Number(value);

  if (isNaN(year)) {
    return 0;
  }

  return year < 100 ? 2000 + year : year;
};

const shouldIgnoreLine = (line: string) => {
  const normalizedLine = line.toLowerCase();
  if (!/[a-z0-9]/i.test(normalizedLine)) return true;

  return [
    'statement period',
    'account number',
    'account name',
    'branch',
    'opening balance',
    'closing balance',
    'available balance',
    'generated on',
    'customer id',
    'ifsc',
    'micr',
    'txn date',
    'transaction date',
    'value date',
    'withdrawal amt',
    'deposit amt',
    'balance'
  ].some((keyword) => normalizedLine.includes(keyword) && normalizedLine.length < keyword.length + 20);
};

const NOISE_TOKENS = new Set([
  'upi', 'neft', 'imps', 'rtgs', 'achdr', 'ach', 'tfr', 'transfer',
  'ref', 'txn', 'id', 'cr', 'dr', 'inb', 'mob', 'net', 'cms',
  'trf', 'bil', 'ecs', 'nach', 'si', 'auto', 'pay', 'payment',
  'to', 'from', 'by', 'via', 'p2p', 'p2m'
]);

const cleanDescription = (raw: string): string => {
  // 1. Try to extract a name from UPI ID (xxx@upi → xxx)
  const upiIdMatch = raw.match(/([a-zA-Z][a-zA-Z0-9._-]*)@[a-zA-Z]+/i);
  let upiName = '';
  if (upiIdMatch) {
    upiName = upiIdMatch[1]
      .replace(/[._-]/g, ' ')
      .replace(/\d+/g, '')
      .trim();
  }

  // 2. Split into tokens using / - and whitespace
  const tokens = raw
    .split(/[-/\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  // 3. Filter tokens
  const meaningfulTokens = tokens.filter((token) => {
    const lower = token.toLowerCase();
    // Remove noise keywords
    if (NOISE_TOKENS.has(lower)) return false;
    // Remove pure numeric tokens
    if (/^\d+$/.test(token)) return false;
    // Remove UPI IDs (xxx@yyy)
    if (/@/.test(token)) return false;
    // Remove very short tokens (<=2 chars) unless it's a known word
    if (token.length <= 2) return false;
    // Must contain at least one letter
    if (!/[a-zA-Z]/.test(token)) return false;
    return true;
  });

  // 4. Priority: prefer name-like tokens (letters, >4 chars)
  const nameLikeTokens = meaningfulTokens.filter(
    (t) => /^[a-zA-Z\s]+$/.test(t) && t.length > 4
  );

  if (nameLikeTokens.length > 0) {
    return nameLikeTokens.join(' ');
  }

  // 5. Fallback to UPI name if extracted
  if (upiName && upiName.length > 2) {
    return upiName;
  }

  // 6. Fallback to any meaningful tokens
  if (meaningfulTokens.length > 0) {
    return meaningfulTokens.join(' ');
  }

  return 'Transaction';
};
