import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Car, Gauge, Printer, Receipt, Search, WalletCards, X } from "lucide-react";
import { printMaintenanceReport } from "@/lib/maintenance-export";

export default function Reports() {
  const [vehicleSearch, setVehicleSearch] = useState("");
  const { data, isLoading } = trpc.invoice.maintenanceReport.useQuery({
    vehicleNumber: vehicleSearch.trim() || undefined,
  });

  const generatedAt = new Date().toLocaleString("ar-SA", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <div className="maintenance-report animate-fade-in space-y-6">
      <div className="report-header flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="hidden print:block text-sm text-gray-500 mb-1">شركة نبيل عبد الله ابو نهية - إدارة صيانة الأسطول</p>
          <h1 className="text-2xl md:text-3xl font-bold">تقرير عمليات الصيانة</h1>
          <p className="text-white/50 print:text-gray-600 mt-1">
            تقرير شامل لجميع عمليات الصيانة والتكاليف المسجلة
          </p>
          <p className="hidden print:block text-xs text-gray-500 mt-2">تاريخ إصدار التقرير: {generatedAt}</p>
        </div>
        <button
          type="button"
          onClick={() => data && printMaintenanceReport({
            title: vehicleSearch ? `تقرير صيانة السيارة ${vehicleSearch}` : "تقرير عمليات صيانة الأسطول",
            subtitle: vehicleSearch ? `جميع العمليات المطابقة لرقم ${vehicleSearch}` : "جميع عمليات الصيانة المسجلة",
            operations: data.operations,
            totalCost: data.totalCost,
          })}
          disabled={isLoading || !data}
          className="no-print inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
        >
          <Printer className="w-4 h-4" />
          طباعة التقرير
        </button>
      </div>

      <div className="no-print glass-card rounded-xl p-4">
        <label htmlFor="vehicle-report-search" className="block text-sm text-white/60 mb-2">
          البحث برقم السيارة
        </label>
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
          <input
            id="vehicle-report-search"
            type="search"
            value={vehicleSearch}
            onChange={(event) => setVehicleSearch(event.target.value)}
            placeholder="اكتب رقم السيارة لعرض تقريرها..."
            className="w-full pr-12 pl-12 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/10 transition-all"
          />
          {vehicleSearch && (
            <button
              type="button"
              onClick={() => setVehicleSearch("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/10"
              aria-label="مسح البحث"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {vehicleSearch && (
          <p className="text-xs text-orange-400 mt-2">النتائج المطابقة لرقم السيارة: {vehicleSearch}</p>
        )}
      </div>

      <div className="report-summary grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard icon={<Receipt className="w-5 h-5" />} title="عمليات الصيانة" value={data?.operationsCount || 0} />
        <SummaryCard icon={<Car className="w-5 h-5" />} title="عدد السيارات" value={data?.vehiclesCount || 0} />
        <SummaryCard
          icon={<WalletCards className="w-5 h-5" />}
          title="إجمالي التكاليف"
          value={`${(data?.totalCost || 0).toLocaleString("ar-SA")} ر.س`}
          highlight
        />
      </div>

      <div className="report-table glass-card rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 print:border-gray-300 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">تفاصيل عمليات الصيانة</h2>
            <p className="text-sm text-white/40 print:text-gray-500 mt-1">
              {vehicleSearch ? `السيارة: ${vehicleSearch}` : "جميع السيارات"}
            </p>
          </div>
          <span className="text-sm text-white/40 print:text-gray-600">{data?.operationsCount || 0} عملية</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-56">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full loading-spinner" />
          </div>
        ) : data?.operations.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="bg-white/5 print:bg-gray-100 border-b border-white/10 print:border-gray-300">
                  <th className="text-right py-3 px-4 text-sm font-medium text-white/60 print:text-black">م</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-white/60 print:text-black">رقم السيارة</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-white/60 print:text-black">اسم عملية الصيانة</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-white/60 print:text-black">التاريخ</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-white/60 print:text-black">العداد</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-white/60 print:text-black">مركز الصيانة</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/60 print:text-black">التكلفة</th>
                </tr>
              </thead>
              <tbody>
                {data.operations.map((operation, index) => (
                  <tr key={operation.id} className="border-b border-white/5 print:border-gray-200 last:border-0">
                    <td className="py-3 px-4 text-white/40 print:text-gray-600">{index + 1}</td>
                    <td className="py-3 px-4 font-semibold whitespace-nowrap">{operation.vehicleNumber || "غير مسجل"}</td>
                    <td className="py-3 px-4">
                      <p className="font-medium">{operation.maintenanceName || operation.description || "عملية صيانة"}</p>
                      {operation.description && operation.maintenanceName && (
                        <p className="text-xs text-white/40 print:text-gray-500 mt-1 max-w-xs">{operation.description}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">{new Date(operation.date).toLocaleDateString("ar-SA")}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {operation.odometer !== null ? (
                        <span className="inline-flex items-center gap-1"><Gauge className="w-4 h-4 no-print" />{operation.odometer.toLocaleString("ar-SA")} كم</span>
                      ) : "-"}
                    </td>
                    <td className="py-3 px-4">{operation.vendorName}</td>
                    <td className="py-3 px-4 text-left font-bold text-orange-500 print:text-black whitespace-nowrap">
                      {Number(operation.totalAmount).toLocaleString("ar-SA")} ر.س
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-orange-600/10 print:bg-gray-100 border-t-2 border-orange-500/30 print:border-gray-400">
                  <td colSpan={6} className="py-4 px-4 font-bold">الإجمالي</td>
                  <td className="py-4 px-4 text-left font-bold text-lg text-orange-500 print:text-black whitespace-nowrap">
                    {(data.totalCost || 0).toLocaleString("ar-SA")} ر.س
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center">
            <Car className="w-14 h-14 text-white/10 mx-auto mb-3" />
            <p className="text-white/50">لا توجد عمليات صيانة مطابقة</p>
            <p className="text-white/30 text-sm mt-1">راجع رقم السيارة أو امسح البحث لعرض جميع العمليات</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  title,
  value,
  highlight = false,
}: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="glass-card rounded-xl p-5 print:border print:border-gray-300 print:bg-white">
      <div className="flex items-center gap-2 text-white/50 print:text-gray-600 text-sm">
        <span className="text-orange-500 print:text-black">{icon}</span>
        {title}
      </div>
      <p className={`text-2xl font-bold mt-2 ${highlight ? "text-orange-500 print:text-black" : ""}`}>{value}</p>
    </div>
  );
}
