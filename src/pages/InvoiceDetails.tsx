import { trpc } from "@/providers/trpc";
import { Link, useParams, useNavigate } from "react-router";
import {
  Receipt,
  Calendar,
  Store,
  Tag,
  FileText,
  ArrowRight,
  Loader2,
  Trash2,
  Car,
  Gauge,
} from "lucide-react";

const serviceTypeLabels: Record<string, string> = {
  electricity: "كهرباء",
  plumbing: "سباكة",
  hvac: "تكييف",
  electronics: "إلكترونيات",
  carpentry: "نجارة",
  painting: "دهان",
  cleaning: "تنظيف",
  other: "أخرى",
};

export default function InvoiceDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invoiceId = parseInt(id || "0");

  const { data: invoice, isLoading } = trpc.invoice.getById.useQuery({
    id: invoiceId,
  });

  const utils = trpc.useUtils();
  const deleteMutation = trpc.invoice.delete.useMutation({
    onSuccess: () => {
      utils.invoice.list.invalidate();
      utils.invoice.stats.invalidate();
      utils.invoice.vehicles.invalidate();
      navigate("/invoices");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-orange-500 loading-spinner" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-16">
        <Receipt className="w-16 h-16 text-white/10 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">الفاتورة غير موجودة</h2>
        <p className="text-white/50 mb-4">
          الفاتورة التي تبحث عنها غير موجودة أو تم حذفها
        </p>
        <Link
          to="/invoices"
          className="inline-flex items-center gap-2 text-orange-500 hover:text-orange-400"
        >
          <ArrowRight className="w-4 h-4" />
          العودة للفواتير
        </Link>
      </div>
    );
  }

  const handleDelete = () => {
    if (confirm("هل أنت متأكد من حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.")) {
      deleteMutation.mutate({ id: invoiceId });
    }
  };

  return (
    <div className="animate-fade-in max-w-3xl mx-auto space-y-6">
      {/* Back Link */}
      <Link
        to="/invoices"
        className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors"
      >
        <ArrowRight className="w-4 h-4" />
        العودة للفواتير
      </Link>

      {/* Invoice Card */}
      <div className="glass-card rounded-xl overflow-hidden">
        {/* Header */}
        <div className="bg-orange-600/20 px-6 py-4 border-b border-orange-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Receipt className="w-6 h-6 text-orange-500" />
              <div>
                <p className="text-sm text-orange-400 font-mono">
                  #{invoice.invoiceNumber}
                </p>
                <h1 className="text-xl font-bold text-white">
                  {invoice.vendorName}
                </h1>
              </div>
            </div>
            <span className="px-3 py-1.5 bg-orange-600/30 text-orange-400 text-sm rounded-full">
              {serviceTypeLabels[invoice.serviceType] || "أخرى"}
            </span>
          </div>
        </div>

        {/* Image */}
        {invoice.imageUrl && (
          <div className="px-6 pt-6">
            <div className="relative rounded-lg overflow-hidden bg-white/5">
              <img
                src={invoice.imageUrl}
                alt="صورة الفاتورة"
                className="w-full max-h-80 object-contain"
              />
            </div>
          </div>
        )}

        {/* Details */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {invoice.vehicleNumber && (
              <div className="flex items-start gap-3">
                <Car className="w-5 h-5 text-orange-500 mt-0.5" />
                <div>
                  <p className="text-sm text-white/50">رقم السيارة</p>
                  <Link
                    to={`/vehicles/${encodeURIComponent(invoice.vehicleNumber)}`}
                    className="text-white font-medium hover:text-orange-400"
                  >
                    {invoice.vehicleNumber}
                  </Link>
                </div>
              </div>
            )}

            {invoice.odometer !== null && (
              <div className="flex items-start gap-3">
                <Gauge className="w-5 h-5 text-orange-500 mt-0.5" />
                <div>
                  <p className="text-sm text-white/50">عداد السيارة</p>
                  <p className="text-white font-medium">
                    {invoice.odometer.toLocaleString("ar-SA")} كم
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-orange-500 mt-0.5" />
              <div>
                <p className="text-sm text-white/50">التاريخ</p>
                <p className="text-white font-medium">
                  {new Date(invoice.date).toLocaleDateString("ar-SA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    weekday: "long",
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Store className="w-5 h-5 text-orange-500 mt-0.5" />
              <div>
                <p className="text-sm text-white/50">اسم المحل</p>
                <p className="text-white font-medium">{invoice.vendorName}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Tag className="w-5 h-5 text-orange-500 mt-0.5" />
              <div>
                <p className="text-sm text-white/50">نوع الخدمة</p>
                <p className="text-white font-medium">
                  {serviceTypeLabels[invoice.serviceType] || "أخرى"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Receipt className="w-5 h-5 text-orange-500 mt-0.5" />
              <div>
                <p className="text-sm text-white/50">المبلغ الإجمالي</p>
                <p className="text-2xl font-bold text-orange-500">
                  {parseFloat(invoice.totalAmount).toLocaleString("ar-SA")}{" "}
                  <span className="text-sm text-white/50">ر.س</span>
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          {invoice.description && (
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-orange-500 mt-0.5" />
                <div>
                  <p className="text-sm text-white/50 mb-1">وصف الخدمة</p>
                  <p className="text-white">{invoice.description}</p>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-white/30 mt-0.5" />
                <div>
                  <p className="text-sm text-white/50 mb-1">ملاحظات</p>
                  <p className="text-white/70">{invoice.notes}</p>
                </div>
              </div>
            </div>
          )}

          {/* Created Info */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-sm text-white/30">
            <span>
              تم الإنشاء:{" "}
              {new Date(invoice.createdAt).toLocaleDateString("ar-SA")}
            </span>
            <span>
              آخر تحديث:{" "}
              {new Date(invoice.updatedAt).toLocaleDateString("ar-SA")}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors disabled:opacity-50"
        >
          {deleteMutation.isPending ? (
            <Loader2 className="w-4 h-4 loading-spinner" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          حذف الفاتورة
        </button>
      </div>
    </div>
  );
}
