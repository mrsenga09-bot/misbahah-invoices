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
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
};

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩۰-۹]/g, (digit) => digitMap[digit] ?? digit)
    .replace(/٫/g, ".")
    .replace(/٬/g, ",");
}

function parseAmount(value: string) {
  const normalized = normalizeDigits(value).replace(/,/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return undefined;

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 99_999_999.99) {
    return undefined;
  }

  return normalized;
}

export function extractInvoiceAmount(text: string) {
  const normalized = normalizeDigits(text);
  const labeledPatterns = [
    /(?:الإجمالي\s*المستحق|الإجمالي|الاجمالي|المجموع|المبلغ|grand\s*total|total|amount)\s*[:：-]?\s*(\d[\d,]*(?:\.\d{1,2})?)/giu,
    /(\d[\d,]*(?:\.\d{1,2})?)\s*(?:ر\.?\s*س|ريال(?:\s+سعودي)?|sar|sr)\b/giu,
  ];

  for (const pattern of labeledPatterns) {
    for (const match of normalized.matchAll(pattern)) {
      const amount = match[1] ? parseAmount(match[1]) : undefined;
      if (amount) return amount;
    }
  }

  // Unlabelled decimal values are safer than integers, which are often phone
  // numbers, invoice numbers, or dates.
  for (const match of normalized.matchAll(/\b(\d{1,8}\.\d{1,2})\b/g)) {
    const amount = match[1] ? parseAmount(match[1]) : undefined;
    if (amount) return amount;
  }

  return undefined;
}

export function extractOdometer(text: string) {
  const normalized = normalizeDigits(text);
  const match = normalized.match(
    /(?:عداد(?:\s+السيارة)?|الكيلومترات|الممشى|odometer|mileage|km)\s*[:：-]?\s*(\d{1,7})/iu,
  );
  return match?.[1];
}

function extractInvoiceNumber(text: string) {
  const normalized = normalizeDigits(text);
  const match = normalized.match(
    /(?:invoice\s*(?:no|number|#)?|inv\s*(?:no|#)?|Ø±Ù‚Ù…\s*Ø§Ù„ÙØ§ØªÙˆØ±Ø©|ÙØ§ØªÙˆØ±Ø©\s*Ø±Ù‚Ù…)\s*[:#ï¼š-]?\s*([A-Z0-9-]{3,30})/iu,
  );
  return match?.[1];
}

function extractVehicleNumber(text: string) {
  const normalized = normalizeDigits(text);
  const labeled = normalized.match(
    /(?:Ø±Ù‚Ù…\s*(?:Ø§Ù„Ø³ÙŠØ§Ø±Ø©|Ø§Ù„Ù…Ø±ÙƒØ¨Ø©|Ø§Ù„Ù„ÙˆØ­Ø©)|Ù„ÙˆØ­Ø©|plate|vehicle|car)\s*[:#ï¼š-]?\s*([A-Z0-9\u0600-\u06ff -]{2,20})/iu,
  );
  if (labeled?.[1]) return labeled[1].trim();

  const compactPlate = normalized.match(/\b([A-Z]{2,4}\s*\d{2,5})\b/i);
  return compactPlate?.[1]?.replace(/\s+/g, "");
}

function extractDate(text: string) {
  const normalized = normalizeDigits(text);
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
    .map((line) => line.trim())
    .filter((line) => line.length > 2);

  return {
    invoiceNumber: extractInvoiceNumber(text),
    vehicleNumber: extractVehicleNumber(text),
    vendorName: lines[0]?.substring(0, 50),
    maintenanceName: lines.find((line) => /Ø²ÙŠØª|Ø¨Ø·Ø§Ø±ÙŠ|Ø¥Ø·Ø§Ø±|ÙØ±Ø§Ù…Ù„|maintenance|service|oil|battery|tire/i.test(line))?.substring(0, 120),
    totalAmount: extractInvoiceAmount(text),
    date: extractDate(text),
    odometer: extractOdometer(text),
    description: text.substring(0, 200).replace(/\n/g, " "),
  };
}
