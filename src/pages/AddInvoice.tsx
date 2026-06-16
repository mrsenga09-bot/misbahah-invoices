import { useState, useRef, useCallback } from "react";
import { trpc } from "@/providers/trpc";
import { useNavigate, useSearchParams } from "react-router";
import { Link } from "react-router";
import {
  Receipt,
  Camera,
  Upload,
  ScanLine,
  Loader2,
  Check,
  X,
  ArrowRight,
  FileStack,
  Save,
} from "lucide-react";
import Tesseract from "tesseract.js";
import {
  extractInvoiceData,
  type ExtractedInvoiceData,
} from "@/lib/invoice-ocr";

const serviceTypes = [
  { value: "electricity", label: "كهرباء وبطارية" },
  { value: "plumbing", label: "زيوت وفلاتر" },
  { value: "hvac", label: "تكييف" },
  { value: "electronics", label: "فحص إلكتروني" },
  { value: "carpentry", label: "محرك وميكانيكا" },
  { value: "painting", label: "هيكل ودهان" },
  { value: "cleaning", label: "إطارات وفرامل" },
  { value: "other", label: "أخرى" },
];

type BatchInvoiceRow = {
  id: string;
  fileName: string;
  invoiceNumber: string;
  vehicleNumber: string;
  odometer: string;
  maintenanceName: string;
  date: string;
  vendorName: string;
  totalAmount: string;
  description: string;
  status: "ready" | "missing" | "saved" | "error";
  message?: string;
};

type OcrPage = {
  dataUrl: string;
  fileName: string;
};

type PdfJsModule = {
  getDocument: (input: { data: ArrayBuffer }) => { promise: Promise<any> };
  GlobalWorkerOptions: { workerSrc: string };
};

const PDFJS_URL = "https://esm.sh/pdfjs-dist@4.10.38/build/pdf.mjs";
const PDFJS_WORKER_URL = "https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs";
let pdfJsPromise: Promise<PdfJsModule> | null = null;

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

async function loadPdfJs() {
  pdfJsPromise ??= import(/* @vite-ignore */ PDFJS_URL).then((module) => {
    const pdfjs = module as PdfJsModule;
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    return pdfjs;
  });
  return pdfJsPromise;
}

export default function AddInvoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"manual" | "scan" | "batch">("manual");
  const [isScanning, setIsScanning] = useState(false);
  const [isBatchScanning, setIsBatchScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedInvoiceData | null>(null);
  const [batchRows, setBatchRows] = useState<BatchInvoiceRow[]>([]);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    invoiceNumber: `INV-${Date.now().toString(36).toUpperCase()}`,
    vehicleNumber: searchParams.get("vehicle") || "",
    odometer: "",
    maintenanceName: "",
    date: new Date().toISOString().split("T")[0],
    vendorName: "",
    serviceType: "electricity",
    description: "",
    totalAmount: "",
    notes: "",
    imageUrl: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: fleetAssets } = trpc.fleet.list.useQuery();
  const createMutation = trpc.invoice.create.useMutation({
    onSuccess: () => {
      utils.invoice.list.invalidate();
      utils.invoice.stats.invalidate();
      utils.invoice.vehicles.invalidate();
      utils.fleet.list.invalidate();
      utils.fleet.dashboard.invalidate();
      navigate("/invoices");
    },
    onError: (error) => {
      console.error("Failed to create invoice:", error);
      setSubmitError("تعذر حفظ الفاتورة. حاول مرة أخرى أو استخدم صورة أصغر.");
    },
  });
  const createManyMutation = trpc.invoice.createMany.useMutation({
    onSuccess: (data) => {
      utils.invoice.list.invalidate();
      utils.invoice.stats.invalidate();
      utils.invoice.vehicles.invalidate();
      utils.fleet.list.invalidate();
      utils.fleet.dashboard.invalidate();
      setBatchRows((rows) =>
        rows.map((row) =>
          row.status === "ready" ? { ...row, status: "saved", message: "تم الحفظ" } : row,
        ),
      );
      setBatchMessage(`تم حفظ ${data.created} فاتورة بنجاح.`);
    },
    onError: (error) => {
      setBatchMessage(`تعذر حفظ الفواتير: ${error.message}`);
    },
  });

  const updateFormField = useCallback(
    (field: string, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    },
    [errors]
  );

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const renderPdfPages = async (file: File, maxPages: number): Promise<OcrPage[]> => {
    const pdfjs = await loadPdfJs();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: OcrPage[] = [];
    const pageCount = Math.min(pdf.numPages || 0, maxPages);

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) continue;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: context, viewport }).promise;
      pages.push({
        dataUrl: canvas.toDataURL("image/png"),
        fileName: pdf.numPages > 1 ? `${file.name} - صفحة ${pageNumber}` : file.name,
      });
    }

    return pages;
  };

  const fileToOcrPages = async (file: File, maxPages = 1): Promise<OcrPage[]> => {
    if (isPdfFile(file)) return renderPdfPages(file, maxPages);
    if (file.type.startsWith("image/")) {
      return [{ dataUrl: await fileToDataUrl(file), fileName: file.name }];
    }
    return [];
  };

  const handleImageUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setSubmitError("حجم الملف أكبر من 10 ميجابايت. اختر صورة أو PDF أصغر.");
      return;
    }

    setSubmitError(null);
    try {
      const firstPage = (await fileToOcrPages(file, 1))[0];
      if (!firstPage) {
        setSubmitError("صيغة الملف غير مدعومة. استخدم صورة أو PDF.");
        return;
      }
      setPreviewImage(firstPage.dataUrl);
      setFormData((prev) => ({ ...prev, imageUrl: firstPage.dataUrl }));
    } catch (error) {
      console.error("File preview error:", error);
      setSubmitError("تعذر قراءة الملف. جرب صورة أو PDF أوضح.");
    }
  };

  const performOCR = async (imageSrc: string) => {
    setIsScanning(true);
    setScanProgress(0);

    try {
      const result = await Tesseract.recognize(imageSrc, "eng+ara", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setScanProgress(Math.round(m.progress * 100));
          }
        },
      });

      const text = result.data.text;
      const extracted = extractInvoiceData(text);
      setExtractedData(extracted);

      // Auto-fill form with extracted data
      if (extracted.invoiceNumber) updateFormField("invoiceNumber", extracted.invoiceNumber);
      if (extracted.vehicleNumber) updateFormField("vehicleNumber", extracted.vehicleNumber);
      if (extracted.vendorName) updateFormField("vendorName", extracted.vendorName);
      if (extracted.maintenanceName) updateFormField("maintenanceName", extracted.maintenanceName);
      updateFormField("totalAmount", extracted.totalAmount ?? "");
      if (extracted.date) updateFormField("date", extracted.date);
      if (extracted.odometer) updateFormField("odometer", extracted.odometer);
      if (extracted.description) updateFormField("description", extracted.description);

      if (!extracted.totalAmount) {
        setSubmitError(
          "تمت قراءة نص الفاتورة، لكن لم يتم التعرف على الإجمالي بثقة. أدخل المبلغ يدويًا.",
        );
      }

      setActiveTab("manual");
    } catch (error) {
      console.error("OCR Error:", error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const rowIsReady = (row: BatchInvoiceRow) =>
    Boolean(
      row.invoiceNumber.trim() &&
        row.vehicleNumber.trim() &&
        row.maintenanceName.trim() &&
        row.vendorName.trim() &&
        row.date &&
        row.totalAmount &&
        Number.isFinite(Number(row.totalAmount)) &&
        Number(row.totalAmount) > 0,
    );

  const updateBatchRow = (id: string, field: keyof BatchInvoiceRow, value: string) => {
    setBatchRows((rows) =>
      rows.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, [field]: value } as BatchInvoiceRow;
        return {
          ...next,
          status: rowIsReady(next) ? "ready" : "missing",
          message: rowIsReady(next) ? undefined : "راجع البيانات الناقصة",
        };
      }),
    );
  };

  const handleBatchFiles = async (files: FileList | File[]) => {
    const supportedFiles = Array.from(files).filter(
      (file) => file.type.startsWith("image/") || isPdfFile(file),
    );
    if (!supportedFiles.length) {
      setBatchMessage("اختر فواتير بصيغة صورة أو PDF.");
      return;
    }

    setBatchRows([]);
    setBatchMessage(null);
    setIsBatchScanning(true);
    setBatchProgress({ done: 0, total: supportedFiles.length });

    const today = new Date().toISOString().split("T")[0];
    const pages: OcrPage[] = [];

    for (const file of supportedFiles) {
      if (pages.length >= 100) break;
      try {
        const nextPages = await fileToOcrPages(file, 100 - pages.length);
        pages.push(...nextPages);
      } catch (error) {
        setBatchRows((rows) => [
          ...rows,
          {
            id: `${Date.now()}-${rows.length}`,
            fileName: file.name,
            invoiceNumber: `BULK-${Date.now().toString(36).toUpperCase()}-${rows.length + 1}`,
            vehicleNumber: "",
            odometer: "",
            maintenanceName: "عملية صيانة",
            date: today,
            vendorName: "غير محدد",
            totalAmount: "",
            description: "",
            status: "error",
            message: error instanceof Error ? error.message : "تعذر قراءة الملف",
          },
        ]);
      }
    }

    if (!pages.length) {
      setIsBatchScanning(false);
      setBatchMessage("لم يتم العثور على صفحات قابلة للقراءة داخل الملفات.");
      return;
    }

    setBatchProgress({ done: 0, total: pages.length });

    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      const id = `${Date.now()}-${index}`;
      try {
        const result = await Tesseract.recognize(page.dataUrl, "eng+ara");
        const extracted = extractInvoiceData(result.data.text);
        const row: BatchInvoiceRow = {
          id,
          fileName: page.fileName,
          invoiceNumber: extracted.invoiceNumber || `BULK-${Date.now().toString(36).toUpperCase()}-${index + 1}`,
          vehicleNumber: extracted.vehicleNumber || "",
          odometer: extracted.odometer || "",
          maintenanceName: extracted.maintenanceName || "عملية صيانة",
          date: extracted.date || today,
          vendorName: extracted.vendorName || "غير محدد",
          totalAmount: extracted.totalAmount || "",
          description: extracted.description || "",
          status: "missing",
        };
        row.status = rowIsReady(row) ? "ready" : "missing";
        row.message = row.status === "missing" ? "راجع البيانات الناقصة" : undefined;
        setBatchRows((rows) => [...rows, row]);
      } catch (error) {
        setBatchRows((rows) => [
          ...rows,
          {
            id,
            fileName: page.fileName,
            invoiceNumber: `BULK-${Date.now().toString(36).toUpperCase()}-${index + 1}`,
            vehicleNumber: "",
            odometer: "",
            maintenanceName: "عملية صيانة",
            date: today,
            vendorName: "غير محدد",
            totalAmount: "",
            description: "",
            status: "error",
            message: error instanceof Error ? error.message : "تعذر قراءة الفاتورة",
          },
        ]);
      } finally {
        setBatchProgress({ done: index + 1, total: pages.length });
      }
    }

    setIsBatchScanning(false);
  };

  const saveBatchInvoices = () => {
    const readyRows = batchRows.filter((row) => row.status === "ready" && rowIsReady(row));
    if (!readyRows.length) {
      setBatchMessage("لا توجد فواتير مكتملة للحفظ. راجع رقم السيارة والمبلغ والتاريخ.");
      return;
    }

    createManyMutation.mutate({
      invoices: readyRows.map((row) => ({
        invoiceNumber: row.invoiceNumber.trim(),
        vehicleNumber: row.vehicleNumber.trim(),
        odometer: row.odometer ? Number(row.odometer) : undefined,
        maintenanceName: row.maintenanceName.trim(),
        date: row.date,
        vendorName: row.vendorName.trim(),
        serviceType: "other" as const,
        description: row.description || undefined,
        totalAmount: row.totalAmount,
        notes: `تم الاستيراد من ملف: ${row.fileName}`,
        userId: 1,
      })),
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith("image/") || isPdfFile(file))) {
      handleImageUpload(file);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.vehicleNumber.trim())
      newErrors.vehicleNumber = "رقم السيارة مطلوب";
    if (!formData.maintenanceName.trim())
      newErrors.maintenanceName = "اسم عملية الصيانة مطلوب";
    if (
      formData.odometer &&
      (!Number.isInteger(Number(formData.odometer)) ||
        Number(formData.odometer) < 0 ||
        Number(formData.odometer) > 9_999_999)
    )
      newErrors.odometer = "قراءة العداد غير صالحة";
    if (!formData.vendorName.trim()) newErrors.vendorName = "اسم المحل مطلوب";
    const totalAmount = Number(formData.totalAmount);
    if (
      !formData.totalAmount ||
      !Number.isFinite(totalAmount) ||
      totalAmount <= 0 ||
      totalAmount > 99_999_999.99
    )
      newErrors.totalAmount = "المبلغ غير صالح";
    if (!formData.date) newErrors.date = "التاريخ مطلوب";
    if (!formData.invoiceNumber.trim())
      newErrors.invoiceNumber = "رقم الفاتورة مطلوب";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitError(null);
    createMutation.mutate({
      invoiceNumber: formData.invoiceNumber,
      vehicleNumber: formData.vehicleNumber.trim(),
      odometer: formData.odometer ? Number(formData.odometer) : undefined,
      maintenanceName: formData.maintenanceName.trim(),
      date: formData.date,
      vendorName: formData.vendorName,
      serviceType: formData.serviceType as any,
      description: formData.description || undefined,
      totalAmount: formData.totalAmount,
      imageUrl: formData.imageUrl || undefined,
      notes: formData.notes || undefined,
      userId: 1,
    });
  };

  return (
    <div className="animate-fade-in max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">تسجيل عملية صيانة</h1>
        <p className="text-white/50 mt-1">
          سجّل بيانات الصيانة والتكلفة وارفق الفاتورة يدويًا أو بالمسح الضوئي
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="glass-card rounded-xl p-1 flex gap-1">
        <button
          onClick={() => setActiveTab("manual")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
            activeTab === "manual"
              ? "bg-orange-600 text-white"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          <Receipt className="w-4 h-4" />
          إدخال يدوي
        </button>
        <button
          onClick={() => setActiveTab("scan")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
            activeTab === "scan"
              ? "bg-orange-600 text-white"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          <ScanLine className="w-4 h-4" />
          ماسح ضوئي
        </button>
        <button
          onClick={() => setActiveTab("batch")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
            activeTab === "batch"
              ? "bg-orange-600 text-white"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          <FileStack className="w-4 h-4" />
          رفع فواتير متعددة
        </button>
      </div>

      {activeTab === "batch" && (
        <div className="glass-card rounded-xl p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">رفع ومعالجة فواتير متعددة</h3>
            <p className="text-white/50 text-sm">
              اختر حتى 100 صورة فاتورة. سيقوم النظام بقراءة رقم السيارة، العداد، التاريخ، مركز الصيانة، الإجمالي وباقي البيانات ثم يعرضها للمراجعة قبل الحفظ.
            </p>
          </div>

          <div
            onClick={() => batchInputRef.current?.click()}
            className="border-2 border-dashed border-white/20 rounded-xl p-10 text-center cursor-pointer hover:border-orange-500/50 transition-colors"
          >
            <FileStack className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white font-medium mb-1">اضغط لاختيار عدة فواتير</p>
            <p className="text-white/40 text-sm">PNG, JPG, JPEG, PDF - حتى 100 فاتورة أو صفحة PDF في الدفعة</p>
            <input
              ref={batchInputRef}
              type="file"
              accept="image/*,.pdf,application/pdf"
              multiple
              onChange={(event) => {
                if (event.target.files?.length) void handleBatchFiles(event.target.files);
                event.currentTarget.value = "";
              }}
              className="hidden"
            />
          </div>

          {isBatchScanning && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">جاري قراءة الفواتير...</span>
                <span className="text-orange-500 font-medium">
                  {batchProgress.done} / {batchProgress.total}
                </span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-600 rounded-full transition-all duration-300"
                  style={{
                    width: batchProgress.total
                      ? `${Math.round((batchProgress.done / batchProgress.total) * 100)}%`
                      : "0%",
                  }}
                />
              </div>
            </div>
          )}

          {batchMessage && (
            <p className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
              {batchMessage}
            </p>
          )}

          {batchRows.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold">مراجعة الفواتير قبل الحفظ</h4>
                  <p className="text-white/40 text-sm">
                    الفواتير المكتملة: {batchRows.filter((row) => row.status === "ready").length} من {batchRows.length}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={saveBatchInvoices}
                  disabled={createManyMutation.isPending || isBatchScanning}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded-lg"
                >
                  {createManyMutation.isPending ? <Loader2 className="w-4 h-4 loading-spinner" /> : <Save className="w-4 h-4" />}
                  حفظ الفواتير المكتملة
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead className="bg-white/5 text-white/60">
                    <tr>
                      <th className="p-3 text-right">الملف</th>
                      <th className="p-3 text-right">رقم الفاتورة</th>
                      <th className="p-3 text-right">رقم السيارة</th>
                      <th className="p-3 text-right">العداد</th>
                      <th className="p-3 text-right">عملية الصيانة</th>
                      <th className="p-3 text-right">التاريخ</th>
                      <th className="p-3 text-right">المركز</th>
                      <th className="p-3 text-right">الإجمالي</th>
                      <th className="p-3 text-right">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchRows.map((row) => (
                      <tr key={row.id} className="border-t border-white/10 align-top">
                        <td className="p-2 text-white/60 max-w-[150px] truncate">{row.fileName}</td>
                        <td className="p-2"><input className="fleet-input" value={row.invoiceNumber} onChange={(e) => updateBatchRow(row.id, "invoiceNumber", e.target.value)} /></td>
                        <td className="p-2"><input className="fleet-input" value={row.vehicleNumber} onChange={(e) => updateBatchRow(row.id, "vehicleNumber", e.target.value)} /></td>
                        <td className="p-2"><input className="fleet-input" type="number" value={row.odometer} onChange={(e) => updateBatchRow(row.id, "odometer", e.target.value)} /></td>
                        <td className="p-2"><input className="fleet-input" value={row.maintenanceName} onChange={(e) => updateBatchRow(row.id, "maintenanceName", e.target.value)} /></td>
                        <td className="p-2"><input className="fleet-input" type="date" value={row.date} onChange={(e) => updateBatchRow(row.id, "date", e.target.value)} /></td>
                        <td className="p-2"><input className="fleet-input" value={row.vendorName} onChange={(e) => updateBatchRow(row.id, "vendorName", e.target.value)} /></td>
                        <td className="p-2"><input className="fleet-input" type="number" step="0.01" value={row.totalAmount} onChange={(e) => updateBatchRow(row.id, "totalAmount", e.target.value)} /></td>
                        <td className="p-2">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs ${
                            row.status === "ready"
                              ? "bg-green-500/10 text-green-300"
                              : row.status === "saved"
                                ? "bg-blue-500/10 text-blue-300"
                                : "bg-red-500/10 text-red-300"
                          }`}>
                            {row.status === "ready" ? "جاهزة" : row.status === "saved" ? "محفوظة" : row.message || "ناقص"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* OCR Scan Tab */}
      {activeTab === "scan" && (
        <div className="glass-card rounded-xl p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">مسح الفاتورة</h3>
            <p className="text-white/50 text-sm">
              ارفع صورة الفاتورة وسنقوم باستخراج البيانات تلقائياً
            </p>
          </div>

          {/* Upload Area */}
          {!previewImage ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/20 rounded-xl p-12 text-center cursor-pointer hover:border-orange-500/50 transition-colors"
            >
              <Upload className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white font-medium mb-1">
                اضغط أو اسحب صورة هنا
              </p>
              <p className="text-white/40 text-sm">PNG, JPG, JPEG, PDF</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="relative">
              <img
                src={previewImage}
                alt="فاتورة"
                className="w-full rounded-xl max-h-96 object-contain bg-white/5"
              />
              <button
                onClick={() => {
                  setPreviewImage(null);
                  setExtractedData(null);
                }}
                className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Camera Button */}
          <div className="flex gap-3">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
            >
              <Camera className="w-4 h-4" />
              التقاط صورة
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Scan Button */}
          {previewImage && !isScanning && (
            <button
              onClick={() => performOCR(previewImage)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-medium transition-colors"
            >
              <ScanLine className="w-5 h-5" />
              بدء المسح والاستخراج
            </button>
          )}

          {/* Scanning Progress */}
          {isScanning && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">جاري معالجة الصورة...</span>
                <span className="text-orange-500 font-medium">
                  {scanProgress}%
                </span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-600 rounded-full transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Extracted Data Preview */}
          {extractedData && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-400 mb-3">
                <Check className="w-5 h-5" />
                <span className="font-medium">تم استخراج البيانات</span>
              </div>
              <div className="space-y-2 text-sm">
                {extractedData.vendorName && (
                  <p className="text-white/70">
                    المحل:{" "}
                    <span className="text-white">
                      {extractedData.vendorName}
                    </span>
                  </p>
                )}
                {extractedData.totalAmount && (
                  <p className="text-white/70">
                    المبلغ:{" "}
                    <span className="text-white">
                      {extractedData.totalAmount}
                    </span>
                  </p>
                )}
                {extractedData.date && (
                  <p className="text-white/70">
                    التاريخ:{" "}
                    <span className="text-white">{extractedData.date}</span>
                  </p>
                )}
              </div>
              <button
                onClick={() => setActiveTab("manual")}
                className="mt-4 text-sm text-orange-500 hover:text-orange-400 flex items-center gap-1"
              >
                الانتقال للنموذج للتعديل
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Manual Entry Form */}
      {activeTab === "manual" && (
        <form
          onSubmit={handleSubmit}
          className="glass-card rounded-xl p-6 space-y-6"
        >
          {/* Invoice Image Preview */}
          {previewImage && (
            <div className="relative">
              <img
                src={previewImage}
                alt="معاينة الفاتورة"
                className="w-full max-h-48 object-contain rounded-lg bg-white/5"
              />
              <button
                type="button"
                onClick={() => {
                  setPreviewImage(null);
                  setFormData((p) => ({ ...p, imageUrl: "" }));
                }}
                className="absolute top-2 right-2 p-1 bg-red-500/80 hover:bg-red-500 text-white rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Invoice Number */}
            <div className="space-y-2">
              <label className="text-sm text-white/60">
                رقم الفاتورة <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.invoiceNumber}
                onChange={(e) =>
                  updateFormField("invoiceNumber", e.target.value)
                }
                className={`w-full px-4 py-2.5 bg-white/5 border rounded-lg text-white focus:outline-none focus:border-orange-500/50 transition-colors ${
                  errors.invoiceNumber
                    ? "border-red-500"
                    : "border-white/10"
                }`}
              />
              {errors.invoiceNumber && (
                <p className="text-red-400 text-xs">{errors.invoiceNumber}</p>
              )}
            </div>

            {/* Date */}
            <div className="space-y-2">
              <label className="text-sm text-white/60">
                التاريخ <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => updateFormField("date", e.target.value)}
                className={`w-full px-4 py-2.5 bg-white/5 border rounded-lg text-white focus:outline-none focus:border-orange-500/50 transition-colors ${
                  errors.date ? "border-red-500" : "border-white/10"
                }`}
              />
              {errors.date && (
                <p className="text-red-400 text-xs">{errors.date}</p>
              )}
            </div>

            {/* Vendor Name */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-white/60">
                اسم عملية الصيانة <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.maintenanceName}
                onChange={(e) => updateFormField("maintenanceName", e.target.value)}
                placeholder="مثال: تغيير زيت المحرك والفلاتر"
                className={`w-full px-4 py-2.5 bg-white/5 border rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 transition-colors ${
                  errors.maintenanceName ? "border-red-500" : "border-white/10"
                }`}
              />
              {errors.maintenanceName && (
                <p className="text-red-400 text-xs">{errors.maintenanceName}</p>
              )}
            </div>

            {/* Vendor Name */}
            <div className="space-y-2">
              <label className="text-sm text-white/60">
                رقم السيارة <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                list="fleet-assets"
                value={formData.vehicleNumber}
                onChange={(e) => updateFormField("vehicleNumber", e.target.value)}
                placeholder="مثال: أ ب ج 1234"
                className={`w-full px-4 py-2.5 bg-white/5 border rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 transition-colors ${
                  errors.vehicleNumber ? "border-red-500" : "border-white/10"
                }`}
              />
              <datalist id="fleet-assets">
                {fleetAssets?.map((asset) => (
                  <option key={asset.id} value={asset.assetNumber}>
                    {[asset.name, asset.make, asset.model].filter(Boolean).join(" - ")}
                  </option>
                ))}
              </datalist>
              {errors.vehicleNumber && (
                <p className="text-red-400 text-xs">{errors.vehicleNumber}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/60">عداد السيارة (كم)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={formData.odometer}
                onChange={(e) => updateFormField("odometer", e.target.value)}
                placeholder="يُكتب يدويًا أو يُقرأ من الفاتورة"
                className={`w-full px-4 py-2.5 bg-white/5 border rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 transition-colors ${
                  errors.odometer ? "border-red-500" : "border-white/10"
                }`}
              />
              {errors.odometer && (
                <p className="text-red-400 text-xs">{errors.odometer}</p>
              )}
            </div>

            {/* Vendor Name */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-white/60">
                اسم المحل / مزود الخدمة{" "}
                <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.vendorName}
                onChange={(e) => updateFormField("vendorName", e.target.value)}
                placeholder="مثال: شركة الكهرباء السعودية"
                className={`w-full px-4 py-2.5 bg-white/5 border rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 transition-colors ${
                  errors.vendorName
                    ? "border-red-500"
                    : "border-white/10"
                }`}
              />
              {errors.vendorName && (
                <p className="text-red-400 text-xs">{errors.vendorName}</p>
              )}
            </div>

            {/* Service Type */}
            <div className="space-y-2">
              <label className="text-sm text-white/60">
                نوع الخدمة <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.serviceType}
                onChange={(e) =>
                  updateFormField("serviceType", e.target.value)
                }
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-orange-500/50 transition-colors"
              >
                {serviceTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Total Amount */}
            <div className="space-y-2">
              <label className="text-sm text-white/60">
                المبلغ الإجمالي (ر.س) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.totalAmount}
                onChange={(e) =>
                  updateFormField("totalAmount", e.target.value)
                }
                placeholder="0.00"
                className={`w-full px-4 py-2.5 bg-white/5 border rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 transition-colors ${
                  errors.totalAmount
                    ? "border-red-500"
                    : "border-white/10"
                }`}
              />
              {errors.totalAmount && (
                <p className="text-red-400 text-xs">{errors.totalAmount}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-white/60">وصف الخدمة</label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  updateFormField("description", e.target.value)
                }
                placeholder="وصف تفصيلي للخدمة المقدمة..."
                rows={3}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 transition-colors resize-none"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-white/60">ملاحظات إضافية</label>
              <textarea
                value={formData.notes}
                onChange={(e) => updateFormField("notes", e.target.value)}
                placeholder="أي ملاحظات إضافية..."
                rows={2}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 transition-colors resize-none"
              />
            </div>
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <label className="text-sm text-white/60">صورة الفاتورة</label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-white/20 rounded-lg p-6 text-center cursor-pointer hover:border-orange-500/50 transition-colors"
            >
              <Upload className="w-6 h-6 text-white/20 mx-auto mb-2" />
              <p className="text-sm text-white/40">
                اضغط أو اسحب صورة الفاتورة أو PDF هنا
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Submit */}
          {submitError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {submitError}
            </p>
          )}

          <div className="flex items-center gap-3 pt-4">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-5 h-5 loading-spinner" />
              ) : (
                <Check className="w-5 h-5" />
              )}
              حفظ عملية الصيانة
            </button>
            <Link
              to="/invoices"
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
            >
              إلغاء
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
