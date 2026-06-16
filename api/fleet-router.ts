import { z } from "zod";
import { and, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { fleetAssets, invoices } from "@db/schema";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";

const assetInput = z.object({
  assetNumber: z.string().trim().min(1).max(100),
  assetType: z.enum(["vehicle", "equipment"]),
  name: z.string().trim().max(255).optional(),
  make: z.string().trim().max(100).optional(),
  model: z.string().trim().max(100).optional(),
  year: z.number().int().min(1950).max(2100).optional(),
  chassisNumber: z.string().trim().max(150).optional(),
  department: z.string().trim().max(150).optional(),
  status: z.enum(["active", "maintenance", "inactive"]),
  notes: z.string().trim().optional(),
});

export const fleetRouter = createRouter({
  list: publicQuery
    .input(
      z.object({
        search: z.string().trim().optional(),
        assetType: z.enum(["vehicle", "equipment"]).optional(),
        status: z.enum(["active", "maintenance", "inactive"]).optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const filters: SQL[] = [];
      if (input?.assetType) filters.push(eq(fleetAssets.assetType, input.assetType));
      if (input?.status) filters.push(eq(fleetAssets.status, input.status));
      if (input?.search) {
        const search = `%${input.search}%`;
        filters.push(or(
          like(fleetAssets.assetNumber, search),
          like(fleetAssets.name, search),
          like(fleetAssets.make, search),
          like(fleetAssets.model, search),
          like(fleetAssets.chassisNumber, search),
          like(fleetAssets.department, search),
        )!);
      }

      return db
        .select({
          id: fleetAssets.id,
          assetNumber: fleetAssets.assetNumber,
          assetType: fleetAssets.assetType,
          name: fleetAssets.name,
          make: fleetAssets.make,
          model: fleetAssets.model,
          year: fleetAssets.year,
          chassisNumber: fleetAssets.chassisNumber,
          department: fleetAssets.department,
          status: fleetAssets.status,
          notes: fleetAssets.notes,
          operationsCount: sql<number>`count(${invoices.id})`,
          totalCost: sql<string>`coalesce(sum(${invoices.totalAmount}), 0)`,
          latestMaintenance: sql<Date | null>`max(${invoices.date})`,
          latestOdometer: sql<number | null>`max(${invoices.odometer})`,
        })
        .from(fleetAssets)
        .leftJoin(invoices, eq(fleetAssets.assetNumber, invoices.vehicleNumber))
        .where(filters.length ? and(...filters) : undefined)
        .groupBy(fleetAssets.id)
        .orderBy(desc(fleetAssets.updatedAt));
    }),

  get: publicQuery
    .input(z.object({ assetNumber: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = getDb();
      const [asset] = await db
        .select()
        .from(fleetAssets)
        .where(eq(fleetAssets.assetNumber, input.assetNumber));
      const operations = await db
        .select()
        .from(invoices)
        .where(eq(invoices.vehicleNumber, input.assetNumber))
        .orderBy(desc(invoices.date));
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      return {
        asset: asset || null,
        operations,
        operationsCount: operations.length,
        totalCost: operations.reduce((sum, item) => sum + Number(item.totalAmount), 0),
        yearlyCost: operations.reduce((sum, item) =>
          new Date(item.date).getFullYear() === currentYear ? sum + Number(item.totalAmount) : sum, 0),
        monthlyCost: operations.reduce((sum, item) => {
          const date = new Date(item.date);
          return date.getFullYear() === currentYear && date.getMonth() === currentMonth
            ? sum + Number(item.totalAmount) : sum;
        }, 0),
        latestOdometer: operations.reduce<number | null>((latest, item) =>
          item.odometer !== null && (latest === null || item.odometer > latest) ? item.odometer : latest, null),
      };
    }),

  create: publicQuery.input(assetInput).mutation(async ({ input }) => {
    const db = getDb();
    const result = await db.insert(fleetAssets).values({
      ...input,
      name: input.name || null,
      make: input.make || null,
      model: input.model || null,
      year: input.year || null,
      chassisNumber: input.chassisNumber || null,
      department: input.department || null,
      notes: input.notes || null,
    });
    return { success: true, id: Number(result[0].insertId) };
  }),

  importMany: publicQuery
    .input(z.object({ assets: z.array(assetInput).min(1).max(1000) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      let imported = 0;

      await db.transaction(async (tx) => {
        for (const asset of input.assets) {
          await tx.insert(fleetAssets).values({
            ...asset,
            name: asset.name || null,
            make: asset.make || null,
            model: asset.model || null,
            year: asset.year || null,
            chassisNumber: asset.chassisNumber || null,
            department: asset.department || null,
            notes: asset.notes || null,
          }).onDuplicateKeyUpdate({
            set: {
              assetType: asset.assetType,
              name: asset.name || null,
              make: asset.make || null,
              model: asset.model || null,
              year: asset.year || null,
              chassisNumber: asset.chassisNumber || null,
              department: asset.department || null,
              status: asset.status,
              notes: asset.notes || null,
              updatedAt: new Date(),
            },
          });
          imported += 1;
        }
      });

      return { success: true, imported };
    }),

  update: publicQuery
    .input(z.object({ id: z.number(), originalAssetNumber: z.string().min(1), data: assetInput }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.transaction(async (tx) => {
        await tx.update(fleetAssets).set({
          ...input.data,
          name: input.data.name || null,
          make: input.data.make || null,
          model: input.data.model || null,
          year: input.data.year || null,
          chassisNumber: input.data.chassisNumber || null,
          department: input.data.department || null,
          notes: input.data.notes || null,
        }).where(eq(fleetAssets.id, input.id));
        if (input.originalAssetNumber !== input.data.assetNumber) {
          await tx.update(invoices)
            .set({ vehicleNumber: input.data.assetNumber })
            .where(eq(invoices.vehicleNumber, input.originalAssetNumber));
        }
      });
      return { success: true };
    }),

  dashboard: publicQuery.query(async () => {
    const db = getDb();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const [[assets], [costs], recent] = await Promise.all([
      db.select({
        total: sql<number>`count(*)`,
        active: sql<number>`sum(case when ${fleetAssets.status} = 'active' then 1 else 0 end)`,
        inMaintenance: sql<number>`sum(case when ${fleetAssets.status} = 'maintenance' then 1 else 0 end)`,
      }).from(fleetAssets),
      db.select({
        monthly: sql<string>`coalesce(sum(case when year(${invoices.date}) = ${year} and month(${invoices.date}) = ${month} then ${invoices.totalAmount} else 0 end), 0)`,
        yearly: sql<string>`coalesce(sum(case when year(${invoices.date}) = ${year} then ${invoices.totalAmount} else 0 end), 0)`,
        allTime: sql<string>`coalesce(sum(${invoices.totalAmount}), 0)`,
        operations: sql<number>`count(*)`,
      }).from(invoices),
      db.select().from(invoices).orderBy(desc(invoices.date)).limit(6),
    ]);
    return { assets, costs, recent, year, month };
  }),
});
