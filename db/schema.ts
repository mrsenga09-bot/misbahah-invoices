import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  mediumtext,
  timestamp,
  decimal,
  int,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const fleetAssets = mysqlTable("fleet_assets", {
  id: serial("id").primaryKey(),
  assetNumber: varchar("asset_number", { length: 100 }).notNull().unique(),
  assetType: mysqlEnum("asset_type", ["vehicle", "equipment"])
    .default("vehicle")
    .notNull(),
  name: varchar("name", { length: 255 }),
  make: varchar("make", { length: 100 }),
  model: varchar("model", { length: 100 }),
  year: int("year"),
  chassisNumber: varchar("chassis_number", { length: 150 }),
  department: varchar("department", { length: 150 }),
  status: mysqlEnum("status", ["active", "maintenance", "inactive"])
    .default("active")
    .notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type FleetAsset = typeof fleetAssets.$inferSelect;
export type InsertFleetAsset = typeof fleetAssets.$inferInsert;

// Invoices table
export const invoices = mysqlTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
  vehicleNumber: varchar("vehicle_number", { length: 100 }),
  odometer: int("odometer"),
  maintenanceName: varchar("maintenance_name", { length: 255 }),
  date: timestamp("date").notNull(),
  vendorName: varchar("vendor_name", { length: 255 }).notNull(),
  serviceType: mysqlEnum("service_type", [
    "electricity",
    "plumbing",
    "hvac",
    "electronics",
    "carpentry",
    "painting",
    "cleaning",
    "other",
  ]).notNull(),
  description: text("description"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  imageUrl: mediumtext("image_url"),
  notes: text("notes"),
  userId: int("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;
