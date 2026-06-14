import { Routes, Route } from "react-router";
import AppLayout from "@/components/layout/AppLayout";
import Home from "./pages/Home";
import Invoices from "./pages/Invoices";
import AddInvoice from "./pages/AddInvoice";
import InvoiceDetails from "./pages/InvoiceDetails";
import Reports from "./pages/Reports";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Vehicles from "./pages/Vehicles";
import VehicleHistory from "./pages/VehicleHistory";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="*"
        element={
          <AppLayout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoices/:id" element={<InvoiceDetails />} />
              <Route path="/add-invoice" element={<AddInvoice />} />
              <Route path="/vehicles" element={<Vehicles />} />
              <Route path="/vehicles/:vehicleNumber" element={<VehicleHistory />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        }
      />
    </Routes>
  );
}
