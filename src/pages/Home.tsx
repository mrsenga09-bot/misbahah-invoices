import { trpc } from "@/providers/trpc";
import { Link } from "react-router";
import { Receipt, TrendingUp, Calendar, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

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

export default function Home() {
  const { user } = useAuth();
  const { data: stats, isLoading } = trpc.invoice.stats.useQuery();
  const { data: recentInvoices } = trpc.invoice.list.useQuery({
    limit: 5,
    offset: 0,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full loading-spinner" />
      </div>
    );
  }

  const totalAmount = parseFloat(stats?.totalAmount || "0");
  const averageAmount = parseFloat(stats?.averageAmount || "0");

  return (
    <div className="animate-fade-in space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-600/20 to-orange-900/20 border border-orange-500/20 p-6 md:p-10">
        <div className="absolute top-0 left-0 w-64 h-64 bg-orange-500/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="relative">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            مرحباً{user?.name ? `، ${user.name}` : ""} 👋
          </h1>
          <p className="text-white/60 text-lg max-w-lg">
            نظام متكامل لإدارة فواتير الصيانة. سجل فواتيرك بسهولة عبر الإدخال
            اليدوي أو الماسح الضوئي.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/add-invoice"
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-medium transition-colors"
            >
              <Receipt className="w-5 h-5" />
              فاتورة جديدة
            </Link>
            <Link
              to="/invoices"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
            >
              عرض الفواتير
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي الفواتير"
          value={stats?.totalInvoices || 0}
          icon={<Receipt className="w-5 h-5" />}
          color="orange"
        />
        <StatCard
          title="إجمالي المصاريف"
          value={`${totalAmount.toLocaleString("ar-SA")} ر.س`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="متوسط الفاتورة"
          value={`${averageAmount.toLocaleString("ar-SA")} ر.س`}
          icon={<Calendar className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="أكثر الفئات"
          value={
            stats?.byServiceType && stats.byServiceType.length > 0
              ? serviceTypeLabels[stats.byServiceType[0]?.type] || "-"
              : "-"
          }
          icon={<AlertCircle className="w-5 h-5" />}
          color="purple"
        />
      </div>

      {/* Recent Invoices */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">أحدث الفواتير</h2>
          <Link
            to="/invoices"
            className="text-sm text-orange-500 hover:text-orange-400 transition-colors"
          >
            عرض الكل
          </Link>
        </div>

        <div className="space-y-3">
          {recentInvoices?.invoices && recentInvoices.invoices.length > 0 ? (
            recentInvoices.invoices.map((invoice) => (
              <Link
                key={invoice.id}
                to={`/invoices/${invoice.id}`}
                className="glass-card glass-card-hover invoice-card block rounded-xl p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-orange-500 font-mono">
                        #{invoice.invoiceNumber}
                      </span>
                      <span className="px-2 py-1 bg-orange-600/20 text-orange-400 text-xs rounded-full">
                        {serviceTypeLabels[invoice.serviceType] || "أخرى"}
                      </span>
                    </div>
                    <p className="text-white font-medium mt-1">
                      {invoice.vendorName}
                    </p>
                    <p className="text-white/50 text-sm">
                      {new Date(invoice.date).toLocaleDateString("ar-SA")}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-bold text-white">
                      {parseFloat(invoice.totalAmount).toLocaleString("ar-SA")}{" "}
                      ر.س
                    </p>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="glass-card rounded-xl p-8 text-center">
              <Receipt className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/50">لا توجد فواتير مسجلة بعد</p>
              <Link
                to="/add-invoice"
                className="text-orange-500 hover:text-orange-400 text-sm mt-2 inline-block"
              >
                سجل أول فاتورة
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Service Type Distribution */}
      {stats?.byServiceType && stats.byServiceType.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">توزيع الفواتير حسب النوع</h2>
          <div className="glass-card rounded-xl p-6">
            <div className="space-y-3">
              {stats.byServiceType.map((item) => {
                const maxCount = Math.max(
                  ...stats.byServiceType.map((s) => s.count)
                );
                const percentage = (item.count / maxCount) * 100;
                return (
                  <div key={item.type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white/70">
                        {serviceTypeLabels[item.type] || item.type}
                      </span>
                      <span className="text-sm text-white/50">
                        {item.count} فاتورة
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-600 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    orange: "bg-orange-600/20 text-orange-500",
    green: "bg-green-600/20 text-green-500",
    blue: "bg-blue-600/20 text-blue-500",
    purple: "bg-purple-600/20 text-purple-500",
  };

  return (
    <div className="glass-card glass-card-hover rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${colorMap[color] || colorMap.orange}`}>
          {icon}
        </div>
      </div>
      <p className="text-white/50 text-sm mb-1">{title}</p>
      <p className="stat-number text-white">{value}</p>
    </div>
  );
}
