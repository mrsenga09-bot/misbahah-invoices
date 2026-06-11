import { useState, useRef, useCallback } from "react";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router";
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
} from "lucide-react";
import Tesseract from "tesseract.js";

const serviceTypes = [
  { value: "electricity", label: "كهرباء" },
  { value: "plumbing", label: "سباكة" },
  { value: "hvac", label: "تكييف" },
  { value: "electronics", label: "إلكترونيات" },
  { value: "carpentry", label: "نجارة" },
  { value: "painting", label: "دهان" },
  { value: "cleaning", label: "تنظيف" },
  { value: "other", label: "أخرى" },
];

interface ExtractedData {
  vendorName?: string;
  totalAmount?: string;
  date?: string;
  description?: string;
}

export default function AddInvoice() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"manual" | "scan">("manual");
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);

  const [formData, setFormData] = useState({
    invoiceNumber: `INV-${Date.now().toString(36).toUpperCase()}`,
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
  const createMutation = trpc.invoice.create.useMutation({
    onSuccess: () => {
      utils.invoice.list.invalidate();
      utils.invoice.stats.invalidate();
      navigate("/invoices");
    },
    onError: (error) => {
      console.error("Failed to create invoice:", error);
      setSubmitError("تعذر حفظ الفاتورة. حاول مرة أخرى أو استخدم صورة أصغر.");
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

  const handleImageUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setSubmitError("حجم الصورة أكبر من 10 ميجابايت. اختر صورة أصغر.");
      return;
    }

    setSubmitError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPreviewImage(result);
      setFormData((prev) => ({ ...prev, imageUrl: result }));
    };
    reader.readAsDataURL(file);
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
      if (extracted.vendorName) updateFormField("vendorName", extracted.vendorName);
      if (extracted.totalAmount) updateFormField("totalAmount", extracted.totalAmount);
      if (extracted.date) updateFormField("date", extracted.date);
      if (extracted.description) updateFormField("description", extracted.description);

      setActiveTab("manual");
    } catch (error) {
      console.error("OCR Error:", error);
    } finally {
      setIsScanning(false);
    }
  };

  const extractInvoiceData = (text: string): ExtractedData => {
    const data: ExtractedData = {};

    // Try to find amount - look for numbers followed by SAR, SR, or ر.س
    const amountMatch =
      text.match(/(?:total|amount|المبلغ|الإجمالي|المجموع)[\s:]*([\d,]+\.?\d*)/i) ||
      text.match(/([\d,]+\.?\d*)\s*(?:SAR|SR|ر\.?س)/i) ||
      text.match(/([\d,]+\.?\d{0,2})/);
    if (amountMatch) {
      data.totalAmount = amountMatch[1].replace(/,/g, "");
    }

    // Try to find date
    const dateMatch =
      text.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/) ||
      text.match(/(\d{4}[\/\-]\d{2}[\/\-]\d{2})/);
    if (dateMatch) {
      const parts = dateMatch[1].split(/[\/\-]/);
      if (parts[2]?.length === 4) {
        data.date = `${parts[2]}-${parts[1]}-${parts[0]}`;
      } else if (parts[0]?.length === 4) {
        data.date = `${parts[0]}-${parts[1]}-${parts[2]}`;
      }
    }

    // Try to find vendor/shop name
    const lines = text.split("\n").filter((l) => l.trim().length > 2);
    if (lines.length > 0) {
      data.vendorName = lines[0].trim().substring(0, 50);
    }

    // Description from remaining text
    data.description = text.substring(0, 200).replace(/\n/g, " ");

    return data;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleImageUpload(file);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.vendorName.trim()) newErrors.vendorName = "اسم المحل مطلوب";
    if (!formData.totalAmount || isNaN(parseFloat(formData.totalAmount)))
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
        <h1 className="text-2xl md:text-3xl font-bold">فاتورة جديدة</h1>
        <p className="text-white/50 mt-1">
          أضف فاتورة صيانة جديدة يدوياً أو عبر الماسح الضوئي
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
      </div>

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
              <p className="text-white/40 text-sm">PNG, JPG, JPEG</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
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
                اضغط أو اسحب صورة الفاتورة هنا
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
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
              حفظ الفاتورة
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
