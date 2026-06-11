import { trpc } from "@/providers/trpc";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

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

const COLORS = [
  "#ea580c",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#6b7280",
];

export default function Reports() {
  const { data: stats, isLoading } = trpc.invoice.stats.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full loading-spinner" />
      </div>
    );
  }

  const totalAmount = parseFloat(stats?.totalAmount || "0");
  const averageAmount = parseFloat(stats?.averageAmount || "0");

  // Prepare pie chart data
  const pieData =
    stats?.byServiceType.map((item) => ({
      name: serviceTypeLabels[item.type] || item.type,
      value: parseFloat(item.total),
      count: item.count,
    })) || [];

  // Prepare monthly chart data
  const monthlyData =
    stats?.monthlyStats.map((item) => ({
      month: item.month,
      total: parseFloat(item.total),
      count: item.count,
    })) || [];

  // Calculate trend
  const hasMultipleMonths = monthlyData.length >= 2;
  const lastMonth = monthlyData[monthlyData.length - 1]?.total || 0;
  const prevMonth = monthlyData[monthlyData.length - 2]?.total || 0;
  const trend =
    hasMultipleMonths && prevMonth > 0
      ? ((lastMonth - prevMonth) / prevMonth) * 100
      : 0;

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">التقارير والإحصائيات</h1>
        <p className="text-white/50 mt-1">
          نظرة شاملة على فواتير الصيانة والمصاريف
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="إجمالي الفواتير"
          value={stats?.totalInvoices || 0}
          subtitle="فاتورة مسجلة"
          icon={<BarChart3 className="w-5 h-5" />}
          color="orange"
        />
        <SummaryCard
          title="إجمالي المصاريف"
          value={`${totalAmount.toLocaleString("ar-SA")} ر.س`}
          subtitle="المجموع الكلي"
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
        />
        <SummaryCard
          title="متوسط الفاتورة"
          value={`${averageAmount.toLocaleString("ar-SA")} ر.س`}
          subtitle="لكل فاتورة"
          icon={<Calendar className="w-5 h-5" />}
          color="blue"
        />
        <SummaryCard
          title="المتغير الشهري"
          value={`${Math.abs(trend).toFixed(1)}%`}
          subtitle={trend >= 0 ? "زيادة" : "انخفاض"}
          icon={
            trend >= 0 ? (
              <TrendingUp className="w-5 h-5" />
            ) : (
              <TrendingDown className="w-5 h-5" />
            )
          }
          color={trend >= 0 ? "green" : "red"}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Expenses Chart */}
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-6">المصاريف الشهرية</h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient
                    id="colorTotal"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#ea580c"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="#ea580c"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.1)"
                />
                <XAxis
                  dataKey="month"
                  stroke="rgba(255,255,255,0.3)"
                  tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.3)"
                  tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
                  tickFormatter={(v) => `${v.toLocaleString()}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1a1a1a",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                  formatter={(value: number) =>
                    [`${value.toLocaleString()} ر.س`, "المبلغ"]
                  }
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#ea580c"
                  fillOpacity={1}
                  fill="url(#colorTotal)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-white/30">
              لا توجد بيانات كافية
            </div>
          )}
        </div>

        {/* Service Type Distribution */}
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-6">
            توزيع المصاريف حسب النوع
          </h3>
          {pieData.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#1a1a1a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                    formatter={(value: number) =>
                      [`${value.toLocaleString()} ر.س`, "المبلغ"]
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {pieData.map((entry, index) => (
                  <div
                    key={entry.name}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: COLORS[index % COLORS.length],
                      }}
                    />
                    <span className="text-white/60">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-white/30">
              لا توجد بيانات كافية
            </div>
          )}
        </div>
      </div>

      {/* Service Type Details Table */}
      {stats?.byServiceType && stats.byServiceType.length > 0 && (
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">تفاصيل حسب نوع الخدمة</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-right py-3 px-4 text-sm text-white/50 font-medium">
                    نوع الخدمة
                  </th>
                  <th className="text-center py-3 px-4 text-sm text-white/50 font-medium">
                    عدد الفواتير
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-white/50 font-medium">
                    إجمالي المبلغ
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.byServiceType.map((item, index) => (
                  <tr
                    key={item.type}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor:
                              COLORS[index % COLORS.length],
                          }}
                        />
                        <span className="text-white">
                          {serviceTypeLabels[item.type] || item.type}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-white/70">
                      {item.count}
                    </td>
                    <td className="py-3 px-4 text-left text-white font-medium">
                      {parseFloat(item.total).toLocaleString("ar-SA")} ر.س
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly Count Chart */}
      {monthlyData.length > 0 && (
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-6">عدد الفواتير الشهري</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.1)"
              />
              <XAxis
                dataKey="month"
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a1a",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  color: "#fff",
                }}
                formatter={(value: number) => [`${value} فاتورة`, "العدد"]}
              />
              <Bar dataKey="count" fill="#ea580c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    orange: "bg-orange-600/20 text-orange-500",
    green: "bg-green-600/20 text-green-500",
    blue: "bg-blue-600/20 text-blue-500",
    red: "bg-red-600/20 text-red-500",
  };

  return (
    <div className="glass-card glass-card-hover rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`p-2 rounded-lg ${colorMap[color] || colorMap.orange}`}
        >
          {icon}
        </div>
      </div>
      <p className="text-white/50 text-sm mb-1">{title}</p>
      <p className="text-xl font-bold text-white mb-1">{value}</p>
      <p className="text-white/40 text-xs">{subtitle}</p>
    </div>
  );
}
