export type ParsedTransactionBlock = {
  date: string;
  description: string;
  rawDescription: string;
  amount: number;
  type: 'credit' | 'debit';
  balance?: number;
};

const DATE_AT_LINE_START =
  /^\s*(?<date>(?:\d{1,2}[/\-\s]\d{1,2}[/\-\s]\d{2,4})|(?:\d{4}[/\-\s]\d{1,2}[/\-\s]\d{1,2})|(?:\d{1,2}[/\-\s][A-Za-z]{3}[/\-\s]\d{2,4}))/;

// Extract numbers cautiously to avoid long IDs. 
// Uses the provided digit-comma patterns to capture proper amounts strictly.
const AMOUNT_TOKEN = /[-+]?\b\d+(?:,\d{2,3})*\.\d{2}(?:\s*(?:CR|DR|Cr|Dr|cr|dr))?\b/gi;

export const parseBankStatementRows = (pageTexts: string[]): ParsedTransactionBlock[] => {
  console.log('--- STARTING GENERIC BLOCK PARSING ---');

  const lines = pageTexts.flatMap((pageText) =>
    pageText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  );

  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  for (const line of lines) {
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

  for (const block of blocks) {
    const fullBlockText = block.join(' ').replace(/\s+/g, ' ').trim();

    const dateMatch = fullBlockText.match(DATE_AT_LINE_START);
    if (!dateMatch?.groups?.date) continue;

    const parsedDate = parseDateString(dateMatch.groups.date);
    if (!parsedDate) continue;

    let remainder = fullBlockText.slice(dateMatch[0].length).trim();

    const secondaryDateMatch = remainder.match(/^(?:\d{1,2}[/\-\s]\d{1,2}[/\-\s]\d{2,4}|\d{1,2}[/\-\s][A-Za-z]{3}[/\-\s]\d{2,4})\s+/);
    if (secondaryDateMatch) {
      remainder = remainder.slice(secondaryDateMatch[0].length).trim();
    }

    const amountMatches = Array.from(remainder.matchAll(AMOUNT_TOKEN));
    const amountTokens = amountMatches.map((match) => match[0].trim());

    let description = remainder;
    for (const token of amountTokens) {
      const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      description = description.replace(new RegExp(escapedToken, 'g'), ' ');
    }
    
    // Aggressive Description Cleaning
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
      continue;
    }

    const numericValues = amountTokens
      .map((token) => {
        const cleaned = token.replace(/,/g, '').replace(/[^\d.-]/g, '');
        return { val: parseFloat(cleaned), str: token };
      })
      .filter((v) => !isNaN(v.val));

    if (numericValues.length === 0) {
      continue;
    }

    let amount = 0;
    let balance: number | undefined;
    let type: 'credit' | 'debit' = 'debit';

    if (numericValues.length === 1) {
      amount = Math.abs(numericValues[0].val);
      
      const str = numericValues[0].str;
      const explicitDir = extractDirection(str);
      if (str.includes('-')) type = 'debit';
      else if (str.includes('+')) type = 'credit';
      else if (explicitDir) type = explicitDir;
      else type = inferDirection(description) ?? 'debit';
      
    } else if (numericValues.length === 2) {
      amount = Math.abs(numericValues[0].val);
      balance = numericValues[1].val;
      
      const str = numericValues[0].str;
      const explicitDir = extractDirection(str);
      if (str.includes('-')) type = 'debit';
      else if (str.includes('+')) type = 'credit';
      else if (explicitDir) type = explicitDir;
      else type = inferDirection(description) ?? 'debit';

    } else if (numericValues.length >= 3) {
      // 3+ numbers: second last is amount (debit/credit), last is balance
      const secondLast = numericValues[numericValues.length - 2];
      const last = numericValues[numericValues.length - 1];

      amount = Math.abs(secondLast.val);
      balance = last.val;

      const str = secondLast.str;
      const explicitDir = extractDirection(str);

      if (str.includes('-')) {
        type = 'debit';
      } else if (str.includes('+')) {
        type = 'credit';
      } else if (explicitDir) {
        type = explicitDir;
      } else {
        // If not explicit, assume Credit is positive, Debit is negative 
        // Note: Absolute was taken just for magnitude. We check original .val
        if (secondLast.val < 0) {
          type = 'debit';
        } else if (secondLast.val > 0) {
          type = 'credit';
        } else {
          type = inferDirection(description) ?? 'debit';
        }
      }
    }

    if (isNaN(amount) || amount === 0) {
      continue;
    }

    const row: ParsedTransactionBlock = {
      date: new Date(parsedDate).toISOString(),
      description: cleanedDescription,
      rawDescription,
      amount,
      type,
      ...(balance !== undefined && { balance })
    };

    rows.push(row);
  }

  console.log("FINAL PARSED ROWS:", rows);
  return rows;
};

const parseDateString = (value: string): Date | null => {
  const trimmedValue = value.replace(/\s+/g, ' ').trim();
  const compactDate = trimmedValue.replace(/\s*[/\-]\s*/g, '-');

  if (/^\d{4}-\d{2}-\d{2}$/.test(compactDate)) {
    return new Date(compactDate);
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(compactDate)) {
    const [day, month, year] = compactDate.split('-');
    return new Date(`${year}-${month}-${day}`);
  }

  const parsed = new Date(compactDate);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  const fallback = new Date(trimmedValue);
  if (!isNaN(fallback.getTime())) {
    return fallback;
  }

  return null;
};

const extractDirection = (token: string): 'debit' | 'credit' | null => {
  if (/\bCR\b/i.test(token)) return 'credit';
  if (/\bDR\b/i.test(token)) return 'debit';
  if (token.trim().startsWith('+')) return 'credit';
  if (token.trim().startsWith('-')) return 'debit';
  return null;
};

const inferDirection = (text: string): 'debit' | 'credit' | null => {
  const normalizedText = text.toLowerCase();
  
  if (
    /\b(cr|credit|deposit|received|salary|interest|refund|reversal|inw|credited)\b/.test(
      normalizedText
    ) && !/\b(dr|debit|withdrawal|fee|charge)\b/.test(normalizedText)
  ) {
    return 'credit';
  }

  if (
    /\b(dr|debit|withdrawal|purchase|upi|atm|pos|charges|charge|fee|emi|imps|neft|rtgs|bill|sent|transfer|paid|debited)\b/.test(
      normalizedText
    )
  ) {
    return 'debit';
  }

  return null;
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
    .split(/[\/\-\s]+/)
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
