import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowRight, Loader2, Save } from "lucide-react";

export default function AddAsset() {
  const navigate = useNavigate();
  const { vehicleNumber } = useParams<{ vehicleNumber: string }>();
  const isEditing = Boolean(vehicleNumber);
  const utils = trpc.useUtils();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    assetNumber: "", assetType: "vehicle", name: "", make: "", model: "",
    year: "", chassisNumber: "", department: "", status: "active", notes: "",
  });
  const { data: existing } = trpc.fleet.get.useQuery(
    { assetNumber: vehicleNumber || "" },
    { enabled: isEditing },
  );
  useEffect(() => {
    if (!existing?.asset) return;
    const asset = existing.asset;
    setForm({
      assetNumber: asset.assetNumber, assetType: asset.assetType,
      name: asset.name || "", make: asset.make || "", model: asset.model || "",
      year: asset.year?.toString() || "", chassisNumber: asset.chassisNumber || "",
      department: asset.department || "", status: asset.status, notes: asset.notes || "",
    });
  }, [existing]);
  const create = trpc.fleet.create.useMutation({
    onSuccess: () => {
      utils.fleet.list.invalidate();
      utils.fleet.dashboard.invalidate();
      navigate(`/vehicles/${encodeURIComponent(form.assetNumber.trim())}`);
    },
    onError: (err) => setError(err.message.includes("Duplicate") ? "رقم الأصل مسجل بالفعل" : "تعذر حفظ الأصل"),
  });
  const updateAsset = trpc.fleet.update.useMutation({
    onSuccess: () => {
      utils.fleet.list.invalidate(); utils.fleet.get.invalidate(); utils.fleet.dashboard.invalidate();
      navigate(`/vehicles/${encodeURIComponent(form.assetNumber.trim())}`);
    },
    onError: () => setError("تعذر تحديث بيانات الأصل"),
  });
  const update = (key: string, value: string) => setForm((old) => ({ ...old, [key]: value }));

  return (
    <div className="animate-fade-in max-w-4xl mx-auto space-y-6">
      <Link to="/vehicles" className="inline-flex items-center gap-2 text-white/50 hover:text-white"><ArrowRight className="w-4 h-4" /> العودة للأسطول</Link>
      <div><h1 className="text-3xl font-bold">{isEditing ? "تعديل بيانات الأصل" : "إضافة سيارة أو معدة"}</h1><p className="text-white/50 mt-1">{isEditing ? "حدّث بيانات السيارة أو المعدة وحالتها التشغيلية" : "أنشئ ملفًا دائمًا للأصل قبل تسجيل عمليات الصيانة"}</p></div>
      <form onSubmit={(event) => {
        event.preventDefault(); setError("");
        const data = {
          assetNumber: form.assetNumber, assetType: form.assetType as "vehicle" | "equipment",
          name: form.name || undefined, make: form.make || undefined, model: form.model || undefined,
          year: form.year ? Number(form.year) : undefined, chassisNumber: form.chassisNumber || undefined,
          department: form.department || undefined, status: form.status as "active" | "maintenance" | "inactive",
          notes: form.notes || undefined,
        };
        if (isEditing && existing?.asset) updateAsset.mutate({ id: existing.asset.id, originalAssetNumber: existing.asset.assetNumber, data });
        else create.mutate(data);
      }} className="glass-card rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="رقم السيارة / المعدة *"><input required value={form.assetNumber} onChange={(e) => update("assetNumber", e.target.value)} placeholder="مثال: GGG44 أو EQ-120" className="fleet-input" /></Field>
        <Field label="نوع الأصل *"><select value={form.assetType} onChange={(e) => update("assetType", e.target.value)} className="fleet-input"><option value="vehicle">سيارة</option><option value="equipment">معدة</option></select></Field>
        <Field label="اسم الأصل"><input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="مثال: سيارة المشرف أو حفار 1" className="fleet-input" /></Field>
        <Field label="القسم / المشروع"><input value={form.department} onChange={(e) => update("department", e.target.value)} placeholder="مثال: التشغيل أو مشروع الرياض" className="fleet-input" /></Field>
        <Field label="الشركة المصنعة"><input value={form.make} onChange={(e) => update("make", e.target.value)} placeholder="تويوتا" className="fleet-input" /></Field>
        <Field label="الموديل"><input value={form.model} onChange={(e) => update("model", e.target.value)} placeholder="هايلكس" className="fleet-input" /></Field>
        <Field label="سنة الصنع"><input type="number" min="1950" max="2100" value={form.year} onChange={(e) => update("year", e.target.value)} placeholder="2024" className="fleet-input" /></Field>
        <Field label="رقم الشاسيه"><input value={form.chassisNumber} onChange={(e) => update("chassisNumber", e.target.value)} className="fleet-input" /></Field>
        <Field label="الحالة"><select value={form.status} onChange={(e) => update("status", e.target.value)} className="fleet-input"><option value="active">تعمل</option><option value="maintenance">تحت الصيانة</option><option value="inactive">متوقفة</option></select></Field>
        <div className="md:col-span-2"><Field label="ملاحظات"><textarea rows={3} value={form.notes} onChange={(e) => update("notes", e.target.value)} className="fleet-input resize-none" /></Field></div>
        {error && <p className="md:col-span-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</p>}
        <div className="md:col-span-2 flex gap-3"><button disabled={create.isPending || updateAsset.isPending} className="flex-1 inline-flex justify-center items-center gap-2 py-3 bg-orange-600 hover:bg-orange-500 rounded-lg font-medium disabled:opacity-50">{create.isPending || updateAsset.isPending ? <Loader2 className="w-5 h-5 loading-spinner" /> : <Save className="w-5 h-5" />} {isEditing ? "حفظ التعديلات" : "حفظ الأصل"}</button><Link to={isEditing ? `/vehicles/${encodeURIComponent(vehicleNumber || "")}` : "/vehicles"} className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-lg">إلغاء</Link></div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-2"><span className="text-sm text-white/60">{label}</span>{children}</label>;
}
