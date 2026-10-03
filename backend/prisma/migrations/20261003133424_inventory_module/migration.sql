/*
  Warnings:

  - You are about to drop the column `sparePartId` on the `WorkOrderPart` table. All the data in the column will be lost.
  - You are about to drop the `SparePart` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SparePartTransaction` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `itemId` to the `WorkOrderPart` table without a default value. This is not possible if the table is not empty.
  - Added the required column `warehouseId` to the `WorkOrderPart` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "SparePart" DROP CONSTRAINT "SparePart_companyId_fkey";

-- DropForeignKey
ALTER TABLE "SparePart" DROP CONSTRAINT "SparePart_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "SparePartTransaction" DROP CONSTRAINT "SparePartTransaction_companyId_fkey";

-- DropForeignKey
ALTER TABLE "SparePartTransaction" DROP CONSTRAINT "SparePartTransaction_sparePartId_fkey";

-- DropForeignKey
ALTER TABLE "WorkOrderPart" DROP CONSTRAINT "WorkOrderPart_sparePartId_fkey";

-- DropIndex
DROP INDEX "WorkOrderPart_sparePartId_idx";

-- Work-order part lines point at spare parts, which this migration removes;
-- they cannot be mapped to inventory items, so they go (the spare-parts data is not kept).
DELETE FROM "WorkOrderPart";

-- AlterTable
ALTER TABLE "WorkOrderPart" DROP COLUMN "sparePartId",
ADD COLUMN     "itemId" INTEGER NOT NULL,
ADD COLUMN     "warehouseId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "SparePart";

-- DropTable
DROP TABLE "SparePartTransaction";

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "itemNumber" TEXT,
    "category" TEXT,
    "minimumStock" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "supplierId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStock" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "workOrderId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Warehouse_status_idx" ON "Warehouse"("status");

-- CreateIndex
CREATE INDEX "Warehouse_companyId_idx" ON "Warehouse"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_companyId_name_key" ON "Warehouse"("companyId", "name");

-- CreateIndex
CREATE INDEX "InventoryItem_supplierId_idx" ON "InventoryItem"("supplierId");

-- CreateIndex
CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category");

-- CreateIndex
CREATE INDEX "InventoryItem_status_idx" ON "InventoryItem"("status");

-- CreateIndex
CREATE INDEX "InventoryItem_companyId_idx" ON "InventoryItem"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_companyId_itemNumber_key" ON "InventoryItem"("companyId", "itemNumber");

-- CreateIndex
CREATE INDEX "InventoryStock_warehouseId_idx" ON "InventoryStock"("warehouseId");

-- CreateIndex
CREATE INDEX "InventoryStock_companyId_idx" ON "InventoryStock"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryStock_itemId_warehouseId_key" ON "InventoryStock"("itemId", "warehouseId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_itemId_idx" ON "InventoryTransaction"("itemId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_warehouseId_idx" ON "InventoryTransaction"("warehouseId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_workOrderId_idx" ON "InventoryTransaction"("workOrderId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_type_idx" ON "InventoryTransaction"("type");

-- CreateIndex
CREATE INDEX "InventoryTransaction_createdAt_idx" ON "InventoryTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "InventoryTransaction_companyId_idx" ON "InventoryTransaction"("companyId");

-- CreateIndex
CREATE INDEX "WorkOrderPart_itemId_idx" ON "WorkOrderPart"("itemId");

-- CreateIndex
CREATE INDEX "WorkOrderPart_warehouseId_idx" ON "WorkOrderPart"("warehouseId");

-- AddForeignKey
ALTER TABLE "WorkOrderPart" ADD CONSTRAINT "WorkOrderPart_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderPart" ADD CONSTRAINT "WorkOrderPart_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Stock can never go below zero, even if application code were to try (the
-- services already refuse it; this is the database's own guarantee).
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_quantity_non_negative" CHECK ("quantity" >= 0);
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_totalQuantity_non_negative" CHECK ("totalQuantity" >= 0);
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_type_valid" CHECK ("type" IN ('IN', 'OUT'));

-- Inventory gets its own permission module (it used to sit under "workshop").
-- Every role keeps exactly the access it had: its workshop flags are copied.
INSERT INTO "Permission" ("roleId", "module", "canView", "canAdd", "canEdit", "canDelete")
SELECT "roleId", 'inventory', "canView", "canAdd", "canEdit", "canDelete"
FROM "Permission"
WHERE "module" = 'workshop'
ON CONFLICT ("roleId", "module") DO NOTHING;
