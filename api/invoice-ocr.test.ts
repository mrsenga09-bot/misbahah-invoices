import { describe, expect, it } from "vitest";
import {
  extractInvoiceAmount,
  extractInvoiceData,
  extractOdometer,
} from "../src/lib/invoice-ocr";

describe("invoice OCR extraction", () => {
  it("does not treat a Saudi phone number as an amount", () => {
    expect(extractInvoiceAmount("هاتف: 0536543385 TEL: 0536543385")).toBeUndefined();
  });

  it("extracts an Arabic labelled amount", () => {
    expect(extractInvoiceAmount("الإجمالي: ١٢٥٫٥٠ ريال سعودي")).toBe("125.50");
  });

  it("treats net amount as the invoice total", () => {
    expect(extractInvoiceAmount("المجموع 200.00\nضريبة القيمة المضافة 30.00\nالصافي 230.00 ر.س")).toBe("230.00");
  });

  it("extracts an English labelled amount", () => {
    expect(extractInvoiceAmount("Grand Total: 2,450.75 SAR")).toBe("2450.75");
  });

  it("extracts a normalized Arabic date", () => {
    expect(extractInvoiceData("متجر الصيانة\nالتاريخ ١١/٠٦/٢٠٢٦").date).toBe("2026-06-11");
  });

  it("extracts an odometer reading", () => {
    expect(extractOdometer("عداد السيارة: ١٢٥٬٤٠٠ كم")).toBe("125400");
  });

  it("extracts an odometer reading from the next line", () => {
    expect(extractOdometer("Current KM\n15,000\nPlate No GGG44")).toBe("15000");
  });

  it("extracts a labelled plate number", () => {
    expect(extractInvoiceData("رقم اللوحة: GGG44\nالصافي 230.00").vehicleNumber).toBe("GGG44");
  });

  it("extracts a plate number from the next line", () => {
    expect(extractInvoiceData("Plate No\nGGG44\nNet Total 230.00").vehicleNumber).toBe("GGG44");
  });

  it("extracts an Arabic plate number", () => {
    expect(extractInvoiceData("لوحة السيارة: أ ب ج ١٢٣٤\nالصافي 230.00").vehicleNumber).toBe("أ ب ج 1234");
  });

  it("extracts plate and odometer when values appear before Arabic labels", () => {
    const text = "112491رقم العداد\nر ع ل9399رقم اللوحة\nالصافي بعد الخصم225.00";
    const data = extractInvoiceData(text);
    expect(data.odometer).toBe("112491");
    expect(data.vehicleNumber).toBe("ر ع ل9399");
  });

  it("extracts fields from invoice 214 text layout", () => {
    const text = [
      "الاجمالي",
      "الخصم",
      "الصافي مئتين و ثمانية و خمسون ريال و خمسة و سبعون هللة فقط",
      "225.00",
      "0.00",
      "258.75",
      "الصافي بعد الخصم225.00",
      "112491رقم العداد",
      "ر ع ل9399رقم اللوحة",
    ].join("\n");
    const data = extractInvoiceData(text);
    expect(data.totalAmount).toBe("258.75");
    expect(data.odometer).toBe("112491");
    expect(data.vehicleNumber).toBe("ر ع ل9399");
  });
});
