import { describe, expect, it } from "vitest";
import { extractInvoiceAmount, extractInvoiceData } from "../src/lib/invoice-ocr";

describe("invoice OCR extraction", () => {
  it("does not treat a Saudi phone number as an amount", () => {
    expect(extractInvoiceAmount("هاتف: 0536543385 TEL: 0536543385")).toBeUndefined();
  });

  it("extracts an Arabic labelled amount", () => {
    expect(extractInvoiceAmount("الإجمالي: ١٢٥٫٥٠ ريال سعودي")).toBe("125.50");
  });

  it("extracts an English labelled amount", () => {
    expect(extractInvoiceAmount("Grand Total: 2,450.75 SAR")).toBe("2450.75");
  });

  it("extracts a normalized Arabic date", () => {
    expect(extractInvoiceData("متجر الصيانة\nالتاريخ ١١/٠٦/٢٠٢٦").date).toBe(
      "2026-06-11",
    );
  });
});
