import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";

const geminiModel = "gemini-2.0-flash";

const invoiceExtractionSchema = z.object({
  invoiceNumber: z.string().optional(),
  vehicleNumber: z.string().optional(),
  odometer: z.string().optional(),
  maintenanceName: z.string().optional(),
  date: z.string().optional(),
  vendorName: z.string().optional(),
  totalAmount: z.string().optional(),
  description: z.string().optional(),
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

      if (input.imageDataUrl && !input.text) {
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
