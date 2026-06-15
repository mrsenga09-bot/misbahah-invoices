type MaintenanceOperation = {
  invoiceNumber: string;
  vehicleNumber: string | null;
  maintenanceName: string | null;
  date: Date | string;
  odometer: number | null;
  vendorName: string;
  description: string | null;
  totalAmount: string;
  notes: string | null;
};

type AssetInfo = {
  assetNumber: string;
  assetType?: string;
  name?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  chassisNumber?: string | null;
  department?: string | null;
};

type ReportData = {
  title: string;
  subtitle?: string;
  asset?: AssetInfo | null;
  operations: MaintenanceOperation[];
  totalCost: number;
  monthlyCost?: number;
  yearlyCost?: number;
};

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const formatMoney = (value: number) => `${value.toLocaleString("ar-SA")} ر.س`;
const formatDate = (value: Date | string) => new Date(value).toLocaleDateString("ar-SA");

export function printMaintenanceReport(report: ReportData) {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "1px";
  frame.style.height = "1px";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  document.body.appendChild(frame);

  const rows = report.operations.map((operation, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(operation.vehicleNumber || "غير مسجل")}</td>
      <td><strong>${escapeHtml(operation.maintenanceName || operation.description || "عملية صيانة")}</strong>${operation.description && operation.maintenanceName ? `<small>${escapeHtml(operation.description)}</small>` : ""}</td>
      <td>${formatDate(operation.date)}</td>
      <td>${operation.odometer === null ? "-" : `${operation.odometer.toLocaleString("ar-SA")} كم`}</td>
      <td>${escapeHtml(operation.vendorName)}</td>
      <td>${escapeHtml(operation.invoiceNumber)}</td>
      <td class="money">${formatMoney(Number(operation.totalAmount))}</td>
    </tr>`).join("");

  const assetDetails = report.asset ? `
    <section class="asset">
      <div><span>رقم الأصل</span><strong>${escapeHtml(report.asset.assetNumber)}</strong></div>
      <div><span>النوع</span><strong>${report.asset.assetType === "equipment" ? "معدة" : "سيارة"}</strong></div>
      <div><span>الاسم</span><strong>${escapeHtml(report.asset.name || "-")}</strong></div>
      <div><span>الماركة والموديل</span><strong>${escapeHtml([report.asset.make, report.asset.model, report.asset.year].filter(Boolean).join(" ") || "-")}</strong></div>
      <div><span>الشاسيه</span><strong>${escapeHtml(report.asset.chassisNumber || "-")}</strong></div>
      <div><span>القسم / المشروع</span><strong>${escapeHtml(report.asset.department || "-")}</strong></div>
    </section>` : "";

  const documentHtml = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title><style>
    @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;color:#171717;margin:0;font-size:11px}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #ea580c;padding-bottom:12px;margin-bottom:14px}h1{font-size:24px;margin:0 0 5px}p{margin:0;color:#666}.brand{color:#ea580c;font-weight:700;font-size:16px}.asset,.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.asset div,.summary div{border:1px solid #ddd;border-radius:6px;padding:9px}.asset span,.summary span{display:block;color:#666;font-size:10px;margin-bottom:4px}.summary strong{font-size:16px}.summary .accent strong{color:#c2410c}table{width:100%;border-collapse:collapse;margin-top:14px}th{background:#f3f4f6;text-align:right;padding:8px;border:1px solid #ccc}td{padding:7px;border:1px solid #ddd;vertical-align:top}tr{break-inside:avoid}small{display:block;color:#666;margin-top:3px;max-width:260px}.money{font-weight:700;white-space:nowrap}tfoot td{font-weight:700;background:#fff7ed;font-size:13px}footer{margin-top:12px;color:#777;font-size:9px;text-align:left}
  </style></head><body><header><div><div class="brand">شركة نبيل عبد الله ابو نهية</div><h1>${escapeHtml(report.title)}</h1><p>${escapeHtml(report.subtitle || "تقرير عمليات الصيانة والتكاليف")}</p></div><div>${new Date().toLocaleString("ar-SA")}</div></header>${assetDetails}<section class="summary"><div><span>عدد عمليات الصيانة</span><strong>${report.operations.length.toLocaleString("ar-SA")}</strong></div>${report.monthlyCost === undefined ? "" : `<div><span>تكلفة الشهر</span><strong>${formatMoney(report.monthlyCost)}</strong></div>`}${report.yearlyCost === undefined ? "" : `<div><span>تكلفة السنة</span><strong>${formatMoney(report.yearlyCost)}</strong></div>`}<div class="accent"><span>إجمالي التكاليف</span><strong>${formatMoney(report.totalCost)}</strong></div></section><table><thead><tr><th>م</th><th>رقم الأصل</th><th>عملية الصيانة</th><th>التاريخ</th><th>العداد</th><th>مركز الصيانة</th><th>رقم الفاتورة</th><th>التكلفة</th></tr></thead><tbody>${rows || '<tr><td colspan="8">لا توجد عمليات صيانة</td></tr>'}</tbody><tfoot><tr><td colspan="7">الإجمالي</td><td class="money">${formatMoney(report.totalCost)}</td></tr></tfoot></table><footer>شركة نبيل عبد الله ابو نهية - إعداد محمد عبد العليم - نظام إدارة صيانة الأسطول</footer></body></html>`;

  const frameWindow = frame.contentWindow;
  const frameDocument = frame.contentDocument;
  if (!frameWindow || !frameDocument) {
    frame.remove();
    return;
  }
  frameDocument.open();
  frameDocument.write(documentHtml);
  frameDocument.close();
  window.setTimeout(() => {
    frameWindow.focus();
    frameWindow.print();
    window.setTimeout(() => frame.remove(), 1000);
  }, 250);
}

export async function exportAssetMaintenanceExcel(report: ReportData) {
  const XLSX = await import("xlsx");
  const asset = report.asset;
  const summary = [
    ["تقرير صيانة الأصل", asset?.assetNumber || report.title],
    ["الاسم", asset?.name || "-"],
    ["الماركة والموديل", [asset?.make, asset?.model, asset?.year].filter(Boolean).join(" ") || "-"],
    ["رقم الشاسيه", asset?.chassisNumber || "-"],
    ["القسم / المشروع", asset?.department || "-"],
    ["عدد عمليات الصيانة", report.operations.length],
    ["تكلفة الشهر", report.monthlyCost || 0],
    ["تكلفة السنة", report.yearlyCost || 0],
    ["إجمالي التكاليف", report.totalCost],
    [],
  ];
  const headers = ["م", "رقم الأصل", "اسم عملية الصيانة", "التاريخ", "العداد (كم)", "مركز الصيانة", "رقم الفاتورة", "الوصف", "التكلفة (ر.س)", "ملاحظات"];
  const rows = report.operations.map((operation, index) => [
    index + 1, operation.vehicleNumber || "", operation.maintenanceName || "عملية صيانة",
    formatDate(operation.date), operation.odometer ?? "", operation.vendorName,
    operation.invoiceNumber, operation.description || "", Number(operation.totalAmount), operation.notes || "",
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([...summary, headers, ...rows]);
  sheet["!cols"] = [8, 16, 28, 15, 15, 25, 18, 40, 16, 30].map((wch) => ({ wch }));
  sheet["!views"] = [{ rightToLeft: true }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Maintenance Log");
  const safeNumber = (asset?.assetNumber || "asset").replace(/[\\/:*?"<>|]/g, "-");
  XLSX.writeFile(workbook, `سجل-صيانة-${safeNumber}.xlsx`);
}
