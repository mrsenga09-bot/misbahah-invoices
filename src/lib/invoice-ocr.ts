export interface ExtractedInvoiceData {
  invoiceNumber?: string;
  vehicleNumber?: string;
  vendorName?: string;
  maintenanceName?: string;
  totalAmount?: string;
  date?: string;
  odometer?: string;
  description?: string;
}

const digitMap: Record<string, string> = {
  "\u0660": "0",
  "\u0661": "1",
  "\u0662": "2",
  "\u0663": "3",
  "\u0664": "4",
  "\u0665": "5",
  "\u0666": "6",
  "\u0667": "7",
  "\u0668": "8",
  "\u0669": "9",
  "\u06f0": "0",
  "\u06f1": "1",
  "\u06f2": "2",
  "\u06f3": "3",
  "\u06f4": "4",
  "\u06f5": "5",
  "\u06f6": "6",
  "\u06f7": "7",
  "\u06f8": "8",
  "\u06f9": "9",
};

function normalizeDigits(value: string) {
  return value
    .replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) => digitMap[digit] ?? digit)
    .replace(/\u066b/g, ".")
    .replace(/\u066c/g, ",")
    .replace(/[٬،]/g, ",")
    .replace(/[٫]/g, ".");
}

function normalizeText(value: string) {
  return normalizeDigits(value)
    .replace(/[：]/g, ":")
    .replace(/[ـ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAmount(value: string) {
  const normalized = normalizeDigits(value)
    .replace(/\s/g, "")
    .replace(/,/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return undefined;

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 99_999_999.99) {
    return undefined;
  }

  return normalized;
}

function extractAmountFromLine(line: string) {
  const amounts = [...normalizeText(line).matchAll(/(\d[\d,\s]*(?:\.\d{1,2})?)/g)]
    .map((match) => match[1] ? parseAmount(match[1]) : undefined)
    .filter((amount): amount is string => Boolean(amount));
  return amounts.at(-1);
}

export function extractInvoiceAmount(text: string) {
  const normalized = normalizeText(text);
  const lines = normalized.split(/\r?\n| {2,}/).map((line) => line.trim()).filter(Boolean);

  const totalLabel =
    /(?:الصافي|صافى|صافي|المبلغ\s*الصافي|صافي\s*المبلغ|الاجمالي\s*الصافي|الإجمالي\s*الصافي|الاجمالي\s*شامل\s*الضريبة|الإجمالي\s*شامل\s*الضريبة|الإجمالي\s*المستحق|الاجمالي\s*المستحق|الإجمالي|الاجمالي|المجموع|المبلغ|grand\s*total|net\s*total|net\s*amount|total\s*amount|total|amount)/iu;

  for (const line of lines) {
    if (!totalLabel.test(line)) continue;
    const amount = extractAmountFromLine(line);
    if (amount) return amount;
  }

  const labeledPatterns = [
    /(?:الصافي|صافى|صافي|net\s*total|grand\s*total|total)\s*[:#-]?\s*(\d[\d,\s]*(?:\.\d{1,2})?)/giu,
    /(\d[\d,\s]*(?:\.\d{1,2})?)\s*(?:ر\.?\s*س|ريال(?:\s+سعودي)?|sar|sr)\b/giu,
  ];

  for (const pattern of labeledPatterns) {
    const amounts = [...normalized.matchAll(pattern)]
      .map((match) => match[1] ? parseAmount(match[1]) : undefined)
      .filter((amount): amount is string => Boolean(amount));
    if (amounts.length) return amounts.at(-1);
  }

  // Decimal values are safer than integers, which are often phone numbers,
  // invoice numbers, dates, or VAT registration numbers.
  const decimals = [...normalized.matchAll(/\b(\d{1,8}\.\d{1,2})\b/g)]
    .map((match) => match[1] ? parseAmount(match[1]) : undefined)
    .filter((amount): amount is string => Boolean(amount));
  return decimals.at(-1);
}

export function extractOdometer(text: string) {
  const normalized = normalizeText(text);
  const patterns = [
    /(?:عداد\s*(?:السيارة|المركبة)?|قراءة\s*العداد|العداد|الممشى|ممشى|الكيلومترات|كيلو\s*متر|odometer|mileage|km)\s*[:#-]?\s*(\d[\d,\s]{1,10})/iu,
    /(\d[\d,\s]{2,10})\s*(?:كم|كيلو\s*متر|km)\b/iu,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const value = match?.[1]?.replace(/[,\s]/g, "");
    if (!value) continue;
    const odometer = Number(value);
    if (Number.isInteger(odometer) && odometer >= 0 && odometer <= 9_999_999) {
      return value;
    }
  }

  return undefined;
}

function extractInvoiceNumber(text: string) {
  const normalized = normalizeText(text);
  const match = normalized.match(
    /(?:invoice\s*(?:no|number|#)?|inv\s*(?:no|#)?|رقم\s*الفاتورة|فاتورة\s*رقم)\s*[:#-]?\s*([A-Z0-9-]{3,30})/iu,
  );
  return match?.[1];
}

function cleanPlateValue(value: string) {
  const cleaned = normalizeText(value)
    .replace(/(?:التاريخ|date|عداد|odometer|المبلغ|الصافي|الإجمالي|الاجمالي).*$/iu, "")
    .replace(/[^\u0600-\u06ffA-Z0-9 -]/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || undefined;
}

function extractVehicleNumber(text: string) {
  const normalized = normalizeText(text);
  const labeled = normalized.match(
    /(?:رقم\s*(?:السيارة|المركبة|اللوحة)|لوحة\s*(?:السيارة|المركبة)?|رقم\s*الأصل|plate\s*(?:no|number)?|vehicle\s*(?:no|number)?|car\s*(?:no|number)?)\s*[:#-]?\s*([A-Z0-9\u0600-\u06ff -]{2,24})/iu,
  );
  if (labeled?.[1]) return cleanPlateValue(labeled[1]);

  const englishPlate = normalized.match(/\b([A-Z]{2,4}\s*\d{2,5})\b/i);
  if (englishPlate?.[1]) return englishPlate[1].replace(/\s+/g, "");

  const arabicLettersThenDigits = normalized.match(/([\u0621-\u064a]\s*[\u0621-\u064a]?\s*[\u0621-\u064a]?)\s*(\d{2,5})/u);
  if (arabicLettersThenDigits?.[0]) return cleanPlateValue(arabicLettersThenDigits[0]);

  const digitsThenArabicLetters = normalized.match(/(\d{2,5})\s*([\u0621-\u064a]\s*[\u0621-\u064a]?\s*[\u0621-\u064a]?)/u);
  if (digitsThenArabicLetters?.[0]) return cleanPlateValue(digitsThenArabicLetters[0]);

  return undefined;
}

function extractDate(text: string) {
  const normalized = normalizeText(text);
  const match =
    normalized.match(/\b(\d{2})[\/-](\d{2})[\/-](\d{4})\b/) ??
    normalized.match(/\b(\d{4})[\/-](\d{2})[\/-](\d{2})\b/);

  if (!match) return undefined;
  if (match[1]?.length === 4) return `${match[1]}-${match[2]}-${match[3]}`;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function extractInvoiceData(text: string): ExtractedInvoiceData {
  const lines = text
    .split("\n")
    .map((line) => normalizeText(line))
    .filter((line) => line.length > 2);

  return {
    invoiceNumber: extractInvoiceNumber(text),
    vehicleNumber: extractVehicleNumber(text),
    vendorName: lines[0]?.substring(0, 50),
    maintenanceName: lines.find((line) => /زيت|بطاري|إطار|اطار|فرامل|صيانة|maintenance|service|oil|battery|tire/i.test(line))?.substring(0, 120),
    totalAmount: extractInvoiceAmount(text),
    date: extractDate(text),
    odometer: extractOdometer(text),
    description: normalizeText(text).substring(0, 200),
  };
}
