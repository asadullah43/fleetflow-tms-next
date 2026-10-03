-- A work order with inventory lines can no longer be deleted (its lines must be removed first, which
-- returns their stock); and each movement gets the date the stock actually moved.

-- DropForeignKey
ALTER TABLE "WorkOrderPart" DROP CONSTRAINT "WorkOrderPart_workOrderId_fkey";

-- AlterTable
ALTER TABLE "InventoryTransaction" ADD COLUMN     "movementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Movements recorded before this column existed moved when they were recorded.
UPDATE "InventoryTransaction" SET "movementDate" = "createdAt";

-- CreateIndex
CREATE INDEX "InventoryTransaction_movementDate_idx" ON "InventoryTransaction"("movementDate");

-- AddForeignKey
ALTER TABLE "WorkOrderPart" ADD CONSTRAINT "WorkOrderPart_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
