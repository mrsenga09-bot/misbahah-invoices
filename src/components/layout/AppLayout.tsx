import { useState } from "react";
import { Link, useLocation } from "react-router";
import { BarChart3, Car, LayoutDashboard, LogOut, Menu, PlusCircle, Receipt, Wrench } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { path: "/", label: "لوحة التحكم", icon: LayoutDashboard },
  { path: "/vehicles", label: "الأسطول", icon: Car },
  { path: "/add-invoice", label: "تسجيل صيانة", icon: PlusCircle },
  { path: "/invoices", label: "الصيانة والفواتير", icon: Receipt },
  { path: "/reports", label: "التقارير والتكاليف", icon: BarChart3 },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return <div className="min-h-screen bg-black text-white flex">
    {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}
    <aside className={`fixed md:sticky top-0 right-0 h-screen w-64 bg-[#0a0a0a] border-l border-white/10 flex flex-col z-50 transition-transform duration-300 md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}`}>
      <div className="p-6 border-b border-white/10"><Link to="/" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}><div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center"><Wrench className="w-5 h-5" /></div><div><h1 className="text-base font-bold leading-6">شركة نبيل عبد الله ابو نهية</h1><p className="text-xs text-white/50">إدارة صيانة الأسطول</p></div></Link></div>
      <nav className="flex-1 p-4 space-y-1">{navItems.map((item) => { const Icon = item.icon; const active = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path); return <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${active ? "bg-orange-600/20 text-orange-500 border-r-2 border-orange-500" : "text-white/60 hover:text-white hover:bg-white/5"}`}><Icon className="w-5 h-5" /><span className="font-medium">{item.label}</span></Link>; })}</nav>
      <div className="p-4 border-t border-white/10">{user ? <div className="space-y-3"><div className="px-4"><p className="text-sm font-medium truncate">{user.name || "المستخدم"}</p></div><button onClick={logout} className="flex items-center gap-3 px-4 py-2 w-full text-red-400 hover:bg-red-500/10 rounded-lg"><LogOut className="w-4 h-4" /> تسجيل الخروج</button></div> : <Link to="/login" className="flex items-center gap-3 px-4 py-3 text-white/60 hover:text-white hover:bg-white/5 rounded-lg"><LogOut className="w-5 h-5" /> تسجيل الدخول</Link>}</div>
    </aside>
    <main className="flex-1 min-h-screen"><header className="md:hidden sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-white/10 px-4 py-3"><div className="flex items-center justify-between"><button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-white/10 rounded-lg"><Menu className="w-5 h-5" /></button><h1 className="text-sm font-bold">شركة نبيل عبد الله ابو نهية</h1><div className="w-9" /></div></header><div className="p-4 md:p-8">{children}</div></main>
  </div>;
}
