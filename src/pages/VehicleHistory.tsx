import { trpc } from "@/providers/trpc";
import { Link, useParams } from "react-router";
import { ArrowRight, Calendar, Car, Gauge, Receipt, Store, Wrench } from "lucide-react";

export default function VehicleHistory() {
  const { vehicleNumber = "" } = useParams<{ vehicleNumber: string }>();
  const { data, isLoading } = trpc.invoice.vehicleHistory.useQuery({ vehicleNumber }, { enabled: Boolean(vehicleNumber) });

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full loading-spinner" /></div>;

  return (
    <div className="animate-fade-in space-y-6">
      <Link to="/vehicles" className="inline-flex items-center gap-2 text-white/50 hover:text-white"><ArrowRight className="w-4 h-4" /> العودة للسيارات</Link>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3"><div className="w-12 h-12 rounded-xl bg-orange-600/20 flex items-center justify-center"><Car className="w-7 h-7 text-orange-500" /></div><div><p className="text-white/40 text-sm">سجل السيارة</p><h1 className="text-2xl md:text-3xl font-bold">{vehicleNumber}</h1></div></div>
        <Link to="/add-invoice" className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 rounded-lg font-medium"><Wrench className="w-4 h-4" /> إضافة صيانة</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-xl p-4"><p className="text-white/40 text-sm">عمليات الصيانة</p><p className="text-2xl font-bold mt-1">{data?.operationsCount || 0}</p></div>
        <div className="glass-card rounded-xl p-4"><p className="text-white/40 text-sm">إجمالي التكاليف</p><p className="text-2xl font-bold text-orange-500 mt-1">{(data?.totalCost || 0).toLocaleString("ar-SA")} ر.س</p></div>
        <div className="glass-card rounded-xl p-4"><div className="flex items-center gap-2 text-white/40 text-sm"><Gauge className="w-4 h-4" /> آخر قراءة عداد</div><p className="text-2xl font-bold mt-1">{data?.latestOdometer !== null && data?.latestOdometer !== undefined ? `${data.latestOdometer.toLocaleString("ar-SA")} كم` : "غير مسجل"}</p></div>
      </div>
      <div className="space-y-3">
        <h2 className="text-xl font-bold">جميع عمليات الصيانة</h2>
        {data?.operations.length ? data.operations.map((operation) => (
          <Link key={operation.id} to={`/invoices/${operation.id}`} className="glass-card glass-card-hover rounded-xl p-5 block">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div><div className="flex flex-wrap items-center gap-3 text-sm text-white/50"><span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date(operation.date).toLocaleDateString("ar-SA")}</span><span className="flex items-center gap-1"><Store className="w-4 h-4" />{operation.vendorName}</span>{operation.odometer !== null && <span className="flex items-center gap-1"><Gauge className="w-4 h-4" />{operation.odometer.toLocaleString("ar-SA")} كم</span>}</div><p className="font-semibold mt-2">{operation.maintenanceName || operation.description || `فاتورة ${operation.invoiceNumber}`}</p></div>
              <div className="flex items-center gap-2 text-xl font-bold text-orange-500"><Receipt className="w-5 h-5" />{Number(operation.totalAmount).toLocaleString("ar-SA")} ر.س</div>
            </div>
          </Link>
        )) : <div className="glass-card rounded-xl p-10 text-center text-white/40">لا توجد عمليات صيانة لهذه السيارة</div>}
      </div>
    </div>
  );
}
