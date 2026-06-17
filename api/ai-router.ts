import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";

const geminiModel = "gemini-2.0-flash";

const optionalAiString = z.preprocess((value) => {
  if (value === null || value === undefined) return undefined;
  return String(value).trim();
}, z.string().optional());

const invoiceExtractionSchema = z.object({
  invoiceNumber: optionalAiString,
  vehicleNumber: optionalAiString,
  odometer: optionalAiString,
  maintenanceName: optionalAiString,
  date: optionalAiString,
  vendorName: optionalAiString,
  totalAmount: optionalAiString,
  description: optionalAiString,
});

function getMimeAndData(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function cleanJson(text: string) {
  return text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

export const aiRouter = createRouter({
  extractInvoice: publicQuery
    .input(z.object({
      text: z.string().optional(),
      imageDataUrl: z.string().optional(),
      fileName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("AI invoice reader is not configured.");
      }

      const aiPrompt = [
        "You are an expert at visually reading Saudi vehicle maintenance invoices from the attached image/PDF page.",
        "Return JSON only, without markdown.",
        "Extract these fields:",
        "invoiceNumber, vehicleNumber, odometer, maintenanceName, date, vendorName, totalAmount, description.",
        "Rules:",
        "- Read the attached invoice image first. Use extracted text only as supporting context.",
        "- vehicleNumber is the actual license plate/vehicle plate near labels like رقم اللوحة, لوحة, plate, vehicle no.",
        "- Never use company names, addresses, service descriptions, invoice titles, city names, or branch names as vehicleNumber.",
        "- Reject values like Car Services, Services, Raqi Center Tires, Industerial Jubail, Industrial Jubail as vehicleNumber.",
        "- For Arabic plate numbers, keep Arabic letters and digits exactly, for example: ر ع ل 9399.",
        "- odometer is the vehicle meter reading near labels like رقم العداد, عداد, odometer, mileage, km. Do not use phone, VAT, invoice, CR, or tax numbers.",
        "- totalAmount is the payable net/grand total. Arabic labels الصافي, الصافي بعد الخصم, الإجمالي, الاجمالي, المبلغ المستحق mean total.",
        "- If a table has subtotal, VAT, and net/payable total, choose the final net/payable total.",
        "- date must be YYYY-MM-DD when possible.",
        "- maintenanceName should briefly describe the maintenance operation, such as تغيير زيت, إطارات, بطارية, فرامل.",
        "- If you are not sure about a field, return an empty string for that field.",
        `File name: ${input.fileName || "invoice"}`,
        input.text ? `Supporting extracted text:\n${input.text}` : "No supporting text is available.",
      ].join("\n");

      const parts: any[] = [{
        text: [
          "You are an expert at extracting Saudi vehicle maintenance invoice data.",
          "Return JSON only, without markdown.",
          "Extract these fields:",
          "invoiceNumber, vehicleNumber, odometer, maintenanceName, date, vendorName, totalAmount, description.",
          "Rules:",
          "- vehicleNumber is the license plate/vehicle plate, never company names or service descriptions.",
          "- Reject values like Car Services, Raqi Center Tires, Industerial Jubail as vehicleNumber.",
          "- For Arabic plate numbers, keep Arabic letters and digits, e.g. ر ع ل 9399.",
          "- odometer is the vehicle meter reading, not phone numbers or tax numbers.",
          "- totalAmount is the payable net/grand total. Arabic labels الصافي, الصافي بعد الخصم, الإجمالي mean total.",
          "- date must be YYYY-MM-DD when possible.",
          "- If a field is missing, omit it or use an empty string.",
          `File name: ${input.fileName || "invoice"}`,
          input.text ? `Invoice text:\n${input.text}` : "Read the invoice image/PDF page.",
        ].join("\n"),
      }];
      parts[0] = { text: aiPrompt };

      if (input.imageDataUrl) {
        const image = getMimeAndData(input.imageDataUrl);
        if (image) {
          parts.push({
            inline_data: {
              mime_type: image.mimeType,
              data: image.data,
            },
          });
        }
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: {
              temperature: 0,
              responseMimeType: "application/json",
            },
          }),
        },
      );

      if (!response.ok) {
        const message = await response.text().catch(() => "");
        throw new Error(`AI invoice reader failed: ${response.status} ${message.slice(0, 200)}`);
      }

      const result: any = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") || "{}";
      const parsed = invoiceExtractionSchema.safeParse(JSON.parse(cleanJson(text)));
      if (!parsed.success) {
        throw new Error("AI returned invoice data in an unexpected format.");
      }

      return parsed.data;
    }),
});
