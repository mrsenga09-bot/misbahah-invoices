import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { invoices } from "@db/schema";
import { and, eq, desc, like, or, sql, type SQL } from "drizzle-orm";

const amountSchema = z.string().refine((value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && amount <= 99_999_999.99;
}, "Invalid maintenance cost");

const odometerSchema = z.number().int().min(0).max(9_999_999).optional();

export const invoiceRouter = createRouter({
  list: publicQuery
    .input(
      z.object({
        search: z.string().optional(),
        serviceType: z.string().optional(),
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();

      const filters: SQL[] = [];
      if (input?.serviceType && input.serviceType !== "all") {
        filters.push(eq(invoices.serviceType, input.serviceType as any));
      }
      if (input?.search) {
        const search = `%${input.search}%`;
        filters.push(
          or(
            like(invoices.vehicleNumber, search),
            like(invoices.invoiceNumber, search),
            like(invoices.vendorName, search),
            like(invoices.description, search),
          )!,
        );
      }

      const where = filters.length > 0 ? and(...filters) : undefined;
      const results = await db
        .select()
        .from(invoices)
        .where(where)
        .orderBy(desc(invoices.createdAt))
        .limit(input?.limit || 50)
        .offset(input?.offset || 0);

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(invoices)
        .where(where);

      return {
        invoices: results,
        total: countResult[0]?.count || 0,
      };
    }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, input.id));
      return result[0] || null;
    }),

  create: publicQuery
    .input(
      z.object({
        invoiceNumber: z.string().min(1),
        vehicleNumber: z.string().trim().min(1),
        odometer: odometerSchema,
        date: z.string().transform((str) => new Date(str)),
        vendorName: z.string().min(1),
        serviceType: z.enum([
          "electricity",
          "plumbing",
          "hvac",
          "electronics",
          "carpentry",
          "painting",
          "cleaning",
          "other",
        ]),
        description: z.string().optional(),
        totalAmount: amountSchema,
        imageUrl: z.string().optional(),
        notes: z.string().optional(),
        userId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(invoices).values({
        invoiceNumber: input.invoiceNumber,
        vehicleNumber: input.vehicleNumber,
        odometer: input.odometer ?? null,
        date: input.date,
        vendorName: input.vendorName,
        serviceType: input.serviceType,
        description: input.description || null,
        totalAmount: input.totalAmount,
        imageUrl: input.imageUrl || null,
        notes: input.notes || null,
        userId: input.userId,
      });
      return { success: true, id: Number(result[0].insertId) };
    }),

  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        invoiceNumber: z.string().optional(),
        vehicleNumber: z.string().trim().min(1).optional(),
        odometer: odometerSchema.nullable(),
        date: z.string().transform((str) => new Date(str)).optional(),
        vendorName: z.string().optional(),
        serviceType: z.enum([
          "electricity",
          "plumbing",
          "hvac",
          "electronics",
          "carpentry",
          "painting",
          "cleaning",
          "other",
        ]).optional(),
        description: z.string().optional(),
        totalAmount: amountSchema.optional(),
        imageUrl: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(invoices).set(data).where(eq(invoices.id, id));
      return { success: true };
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(invoices).where(eq(invoices.id, input.id));
      return { success: true };
    }),

  vehicles: publicQuery.query(async () => {
    const db = getDb();
    return db
      .select({
        vehicleNumber: invoices.vehicleNumber,
        operationsCount: sql<number>`count(*)`,
        totalCost: sql<string>`COALESCE(sum(${invoices.totalAmount}), 0)`,
        latestMaintenance: sql<Date>`max(${invoices.date})`,
        latestOdometer: sql<number | null>`max(${invoices.odometer})`,
      })
      .from(invoices)
      .where(sql`${invoices.vehicleNumber} is not null and ${invoices.vehicleNumber} <> ''`)
      .groupBy(invoices.vehicleNumber)
      .orderBy(desc(sql`max(${invoices.date})`));
  }),

  vehicleHistory: publicQuery
    .input(z.object({ vehicleNumber: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = getDb();
      const operations = await db
        .select()
        .from(invoices)
        .where(eq(invoices.vehicleNumber, input.vehicleNumber))
        .orderBy(desc(invoices.date));

      return {
        vehicleNumber: input.vehicleNumber,
        operations,
        operationsCount: operations.length,
        totalCost: operations.reduce(
          (total, operation) => total + Number(operation.totalAmount),
          0,
        ),
        latestOdometer: operations.reduce<number | null>(
          (latest, operation) =>
            operation.odometer !== null &&
            (latest === null || operation.odometer > latest)
              ? operation.odometer
              : latest,
          null,
        ),
      };
    }),

  stats: publicQuery.query(async () => {
    const db = getDb();

    // Total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices);

    // Total amount
    const amountResult = await db
      .select({ total: sql<string>`COALESCE(sum(${invoices.totalAmount}), 0)` })
      .from(invoices);

    // By service type
    const byServiceType = await db
      .select({
        type: invoices.serviceType,
        count: sql<number>`count(*)`,
        total: sql<string>`COALESCE(sum(${invoices.totalAmount}), 0)`,
      })
      .from(invoices)
      .groupBy(invoices.serviceType);

    // Monthly stats (last 6 months)
    const monthlyStats = await db
      .select({
        month: sql<string>`DATE_FORMAT(${invoices.date}, '%Y-%m')`,
        count: sql<number>`count(*)`,
        total: sql<string>`COALESCE(sum(${invoices.totalAmount}), 0)`,
      })
      .from(invoices)
      .groupBy(sql`DATE_FORMAT(${invoices.date}, '%Y-%m')`)
      .orderBy(desc(sql`DATE_FORMAT(${invoices.date}, '%Y-%m')`))
      .limit(6);

    // Average amount
    const avgResult = await db
      .select({ avg: sql<string>`COALESCE(avg(${invoices.totalAmount}), 0)` })
      .from(invoices);

    return {
      totalInvoices: countResult[0]?.count || 0,
      totalAmount: amountResult[0]?.total || "0",
      averageAmount: avgResult[0]?.avg || "0",
      byServiceType,
      monthlyStats: monthlyStats.reverse(),
    };
  }),
});
