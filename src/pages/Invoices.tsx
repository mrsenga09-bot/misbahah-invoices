import { trpc } from "@/providers/trpc";
import { Link } from "react-router";
import {
  Search,
  Receipt,
  Filter,
  ChevronLeft,
  ChevronRight,
  Car,
  Gauge,
} from "lucide-react";
import { useState } from "react";

const serviceTypes = [
  { value: "all", label: "الكل" },
  { value: "electricity", label: "كهرباء" },
  { value: "plumbing", label: "سباكة" },
  { value: "hvac", label: "تكييف" },
  { value: "electronics", label: "إلكترونيات" },
  { value: "carpentry", label: "نجارة" },
  { value: "painting", label: "دهان" },
  { value: "cleaning", label: "تنظيف" },
  { value: "other", label: "أخرى" },
];

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

export default function Invoices() {
  const [search, setSearch] = useState("");
  const [serviceType, setServiceType] = useState("all");
  const [page, setPage] = useState(0);
  const limit = 10;

  const { data, isLoading } = trpc.invoice.list.useQuery({
    search: search || undefined,
    serviceType: serviceType === "all" ? undefined : serviceType,
    limit,
    offset: page * limit,
  });

  const utils = trpc.useUtils();
  const deleteMutation = trpc.invoice.delete.useMutation({
    onSuccess: () => {
      utils.invoice.list.invalidate();
      utils.invoice.stats.invalidate();
      utils.invoice.vehicles.invalidate();
    },
  });

  const totalPages = Math.ceil((data?.total || 0) / limit);

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذه الفاتورة؟")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">الفواتير</h1>
          <p className="text-white/50 mt-1">
            إدارة وتصفح جميع فواتير الصيانة
          </p>
        </div>
        <Link
          to="/add-invoice"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-medium transition-colors"
        >
          <Receipt className="w-4 h-4" />
          فاتورة جديدة
        </Link>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="البحث في الفواتير..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="w-full pr-10 pl-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 transition-colors"
            />
          </div>

          {/* Service Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-white/40" />
            <select
              value={serviceType}
              onChange={(e) => {
                setServiceType(e.target.value);
                setPage(0);
              }}
              className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-orange-500/50 transition-colors"
            >
              {serviceTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full loading-spinner" />
        </div>
      ) : data?.invoices && data.invoices.length > 0 ? (
        <div className="space-y-3">
          {data.invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="glass-card glass-card-hover invoice-card rounded-xl p-4 md:p-5"
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm text-orange-500 font-mono">
                      #{invoice.invoiceNumber}
                    </span>
                    <span className="px-2.5 py-1 bg-orange-600/20 text-orange-400 text-xs rounded-full">
                      {serviceTypeLabels[invoice.serviceType] || "أخرى"}
                    </span>
                    {invoice.imageUrl && (
                      <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded-full">
                        📎 مرفق
                      </span>
                    )}
                  </div>
                  <h3 className="text-white font-semibold text-lg">
                    {invoice.vendorName}
                  </h3>
                  <p className="text-white/50 text-sm mt-1">
                    {invoice.description || "لا يوجد وصف"}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-white/40">
                    {invoice.vehicleNumber && (
                      <Link
                        to={`/vehicles/${encodeURIComponent(invoice.vehicleNumber)}`}
                        className="flex items-center gap-1 text-orange-400 hover:text-orange-300"
                      >
                        <Car className="w-4 h-4" />
                        {invoice.vehicleNumber}
                      </Link>
                    )}
                    {invoice.odometer !== null && (
                      <span className="flex items-center gap-1">
                        <Gauge className="w-4 h-4" />
                        {invoice.odometer.toLocaleString("ar-SA")} كم
                      </span>
                    )}
                    <span>
                      {new Date(invoice.date).toLocaleDateString("ar-SA", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                    {invoice.notes && <span>ملاحظات: {invoice.notes}</span>}
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4">
                  <p className="text-xl font-bold text-white">
                    {parseFloat(invoice.totalAmount).toLocaleString("ar-SA")}{" "}
                    <span className="text-sm text-white/50">ر.س</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/invoices/${invoice.id}`}
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                      title="عرض التفاصيل"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <button
                      onClick={() => handleDelete(invoice.id)}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                      title="حذف"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <span className="text-sm text-white/50 px-4">
                صفحة {page + 1} من {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="glass-card rounded-xl p-12 text-center">
          <Receipt className="w-16 h-16 text-white/10 mx-auto mb-4" />
          <p className="text-white/50 text-lg mb-2">لا توجد فواتير</p>
          <p className="text-white/30 text-sm mb-4">
            {search || serviceType !== "all"
              ? "جرب تغيير معايير البحث"
              : "ابدأ بتسجيل فاتورة جديدة"}
          </p>
          <Link
            to="/add-invoice"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-medium transition-colors"
          >
            فاتورة جديدة
          </Link>
        </div>
      )}
    </div>
  );
}
