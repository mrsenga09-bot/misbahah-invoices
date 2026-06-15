import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Link } from "react-router";
import { Car, ChevronLeft, CirclePlus, Gauge, HardHat, Search, Wrench } from "lucide-react";

const statusLabels = { active: "تعمل", maintenance: "تحت الصيانة", inactive: "متوقفة" };
const statusStyles = { active: "text-green-400 bg-green-500/10", maintenance: "text-orange-400 bg-orange-500/10", inactive: "text-red-400 bg-red-500/10" };

export default function Vehicles() {
  const [search, setSearch] = useState("");
  const [assetType, setAssetType] = useState("");
  const [status, setStatus] = useState("");
  const { data: assets, isLoading } = trpc.fleet.list.useQuery({
    search: search || undefined,
    assetType: (assetType || undefined) as "vehicle" | "equipment" | undefined,
    status: (status || undefined) as "active" | "maintenance" | "inactive" | undefined,
  });

  return <div className="animate-fade-in space-y-6">
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">إدارة الأسطول</h1><p className="text-white/50 mt-1">سجل مركزي للسيارات والمعدات وتاريخ الصيانة والتكاليف</p></div><div className="flex gap-2"><Link to="/add-invoice" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 rounded-lg"><Wrench className="w-4 h-4" /> تسجيل صيانة</Link><Link to="/vehicles/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 rounded-lg"><CirclePlus className="w-4 h-4" /> إضافة أصل</Link></div></div>
    <div className="glass-card rounded-xl p-4 grid grid-cols-1 md:grid-cols-[1fr_180px_180px] gap-3"><div className="relative"><Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالرقم، الاسم، الشاسيه، الماركة أو القسم..." className="fleet-input pr-10" /></div><select value={assetType} onChange={(e) => setAssetType(e.target.value)} className="fleet-input"><option value="">كل الأصول</option><option value="vehicle">السيارات</option><option value="equipment">المعدات</option></select><select value={status} onChange={(e) => setStatus(e.target.value)} className="fleet-input"><option value="">كل الحالات</option><option value="active">تعمل</option><option value="maintenance">تحت الصيانة</option><option value="inactive">متوقفة</option></select></div>
    <div className="flex items-center justify-between"><p className="text-white/50">الأصول المسجلة: <strong className="text-white">{assets?.length || 0}</strong></p><p className="text-xs text-white/30">مصمم لإدارة 400 سيارة ومعدة وأكثر</p></div>
    {isLoading ? <div className="h-64 flex items-center justify-center"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full loading-spinner" /></div> : assets?.length ? <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{assets.map((asset) => {
      const Icon = asset.assetType === "equipment" ? HardHat : Car;
      return <Link key={asset.id} to={`/vehicles/${encodeURIComponent(asset.assetNumber)}`} className="glass-card glass-card-hover rounded-xl p-5 block"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="w-12 h-12 bg-orange-600/15 rounded-xl flex items-center justify-center"><Icon className="w-6 h-6 text-orange-500" /></div><div><div className="flex items-center gap-2"><h2 className="text-xl font-bold">{asset.assetNumber}</h2><span className={`text-xs px-2 py-1 rounded-full ${statusStyles[asset.status]}`}>{statusLabels[asset.status]}</span></div><p className="text-white/50 text-sm mt-1">{[asset.name, asset.make, asset.model, asset.year].filter(Boolean).join(" · ") || (asset.assetType === "vehicle" ? "سيارة" : "معدة")}</p></div></div><ChevronLeft className="w-5 h-5 text-white/30" /></div><div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5 text-sm"><Metric label="الصيانات" value={asset.operationsCount} /><Metric label="إجمالي التكلفة" value={`${Number(asset.totalCost).toLocaleString("ar-SA")} ر.س`} highlight /><Metric label="آخر عداد" value={asset.latestOdometer !== null ? `${asset.latestOdometer.toLocaleString("ar-SA")} كم` : "-"} icon={<Gauge className="w-3 h-3" />} /><Metric label="آخر صيانة" value={asset.latestMaintenance ? new Date(asset.latestMaintenance).toLocaleDateString("ar-SA") : "-"} /></div></Link>;
    })}</div> : <div className="glass-card rounded-xl p-14 text-center"><Car className="w-16 h-16 text-white/10 mx-auto mb-4" /><p className="text-lg text-white/60">لا توجد أصول مطابقة</p><Link to="/vehicles/new" className="inline-flex mt-4 text-orange-500">إضافة أول سيارة أو معدة</Link></div>}
  </div>;
}

function Metric({ label, value, highlight, icon }: { label: string; value: string | number; highlight?: boolean; icon?: React.ReactNode }) { return <div className="bg-white/5 rounded-lg p-3"><p className="text-white/35 text-xs">{label}</p><p className={`font-semibold mt-1 flex items-center gap-1 ${highlight ? "text-orange-400" : ""}`}>{icon}{value}</p></div>; }
