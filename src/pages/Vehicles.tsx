import { trpc } from "@/providers/trpc";
import { Link } from "react-router";
import { Car, ChevronLeft, Gauge, Receipt, Wrench } from "lucide-react";

export default function Vehicles() {
  const { data: vehicles, isLoading } = trpc.invoice.vehicles.useQuery();

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">السيارات</h1>
          <p className="text-white/50 mt-1">سجل الصيانة والتكاليف الإجمالية لكل سيارة</p>
        </div>
        <Link to="/add-invoice" className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 rounded-lg font-medium transition-colors">
          <Wrench className="w-4 h-4" /> تسجيل صيانة
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full loading-spinner" /></div>
      ) : vehicles && vehicles.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {vehicles.map((vehicle) => (
            <Link key={vehicle.vehicleNumber} to={`/vehicles/${encodeURIComponent(vehicle.vehicleNumber || "")}`} className="glass-card glass-card-hover rounded-xl p-5 block">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-orange-600/20 flex items-center justify-center"><Car className="w-6 h-6 text-orange-500" /></div>
                  <div><p className="text-sm text-white/40">رقم السيارة</p><h2 className="text-xl font-bold">{vehicle.vehicleNumber}</h2></div>
                </div>
                <ChevronLeft className="w-5 h-5 text-white/30" />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-5">
                <div className="bg-white/5 rounded-lg p-3"><div className="flex items-center gap-2 text-white/40 text-sm"><Receipt className="w-4 h-4" /> عدد العمليات</div><p className="font-bold text-lg mt-1">{vehicle.operationsCount}</p></div>
                <div className="bg-white/5 rounded-lg p-3"><p className="text-white/40 text-sm">إجمالي التكلفة</p><p className="font-bold text-lg text-orange-500 mt-1">{Number(vehicle.totalCost).toLocaleString("ar-SA")} ر.س</p></div>
                <div className="bg-white/5 rounded-lg p-3"><div className="flex items-center gap-2 text-white/40 text-sm"><Gauge className="w-4 h-4" /> آخر عداد</div><p className="font-medium mt-1">{vehicle.latestOdometer !== null ? `${vehicle.latestOdometer.toLocaleString("ar-SA")} كم` : "غير مسجل"}</p></div>
                <div className="bg-white/5 rounded-lg p-3"><p className="text-white/40 text-sm">آخر صيانة</p><p className="font-medium mt-1">{vehicle.latestMaintenance ? new Date(vehicle.latestMaintenance).toLocaleDateString("ar-SA") : "-"}</p></div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-xl p-12 text-center"><Car className="w-16 h-16 text-white/10 mx-auto mb-4" /><p className="text-white/50 text-lg">لا توجد سيارات مسجلة بعد</p><p className="text-white/30 text-sm mt-2">سجّل أول عملية صيانة مع رقم السيارة لتظهر هنا</p></div>
      )}
    </div>
  );
}
