-- Multi-tenancy: every business table gets companyId (existing rows -> company 1),
-- unique business numbers become unique per company, plus ApiKey and
-- IdempotencyRecord tables. No data is deleted.

-- DropIndex
DROP INDEX "Truck_truckNumber_key";

-- DropIndex
DROP INDEX "Driver_licenseNo_key";

-- DropIndex
DROP INDEX "Driver_idNumber_key";

-- DropIndex
DROP INDEX "CargoType_name_key";

-- DropIndex
DROP INDEX "Trip_transactionNumber_key";

-- DropIndex
DROP INDEX "RateContract_customerId_pickupLocationId_deliveryLocationId_key";

-- DropIndex
DROP INDEX "Invoice_invoiceNumber_key";

-- DropIndex
DROP INDEX "LoadingOrder_serialNumber_key";

-- DropIndex
DROP INDEX "Role_name_key";

-- DropIndex
DROP INDEX "WorkOrder_orderNumber_key";

-- DropIndex
DROP INDEX "SparePart_partNumber_key";

-- DropIndex
DROP INDEX "Employee_employeeNumber_key";

-- DropIndex
DROP INDEX "Employee_email_key";

-- AlterTable
ALTER TABLE "Truck" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "TruckDriverAssignment" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "CargoType" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "RateContract" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "SupplierPayment" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "LoadingOrder" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "WorkOrderPart" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "MaintenanceSchedule" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "VehicleInspection" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "InspectionItem" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "SparePart" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "SparePartTransaction" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "WorkshopExpense" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Designation" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "EmployeeDocument" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "EmploymentContract" ADD COLUMN     "companyId" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- Existing single-company data becomes company #1 (named after the current company settings).
INSERT INTO "Company" ("id", "name", "updatedAt")
SELECT 1, COALESCE((SELECT "companyName" FROM "CompanySettings" ORDER BY "id" LIMIT 1), 'FleetFlow'), CURRENT_TIMESTAMP;
SELECT setval(pg_get_serial_sequence('"Company"', 'id'), 1);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" INTEGER,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "operation" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_companyId_idx" ON "ApiKey"("companyId");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_companyId_operation_key_key" ON "IdempotencyRecord"("companyId", "operation", "key");

-- CreateIndex
CREATE INDEX "Truck_companyId_idx" ON "Truck"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Truck_companyId_truckNumber_key" ON "Truck"("companyId", "truckNumber");

-- CreateIndex
CREATE INDEX "TruckDriverAssignment_companyId_idx" ON "TruckDriverAssignment"("companyId");

-- CreateIndex
CREATE INDEX "Driver_companyId_idx" ON "Driver"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_companyId_licenseNo_key" ON "Driver"("companyId", "licenseNo");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_companyId_idNumber_key" ON "Driver"("companyId", "idNumber");

-- CreateIndex
CREATE INDEX "Supplier_companyId_idx" ON "Supplier"("companyId");

-- CreateIndex
CREATE INDEX "Customer_companyId_idx" ON "Customer"("companyId");

-- CreateIndex
CREATE INDEX "Location_companyId_idx" ON "Location"("companyId");

-- CreateIndex
CREATE INDEX "CargoType_companyId_idx" ON "CargoType"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CargoType_companyId_name_key" ON "CargoType"("companyId", "name");

-- CreateIndex
CREATE INDEX "Trip_companyId_idx" ON "Trip"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_companyId_transactionNumber_key" ON "Trip"("companyId", "transactionNumber");

-- CreateIndex
CREATE INDEX "RateContract_companyId_idx" ON "RateContract"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "RateContract_companyId_customerId_pickupLocationId_delivery_key" ON "RateContract"("companyId", "customerId", "pickupLocationId", "deliveryLocationId", "cargoTypeId");

-- CreateIndex
CREATE INDEX "Invoice_companyId_idx" ON "Invoice"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_companyId_invoiceNumber_key" ON "Invoice"("companyId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySettings_companyId_key" ON "CompanySettings"("companyId");

-- CreateIndex
CREATE INDEX "SupplierPayment_companyId_idx" ON "SupplierPayment"("companyId");

-- CreateIndex
CREATE INDEX "LoadingOrder_companyId_idx" ON "LoadingOrder"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "LoadingOrder_companyId_serialNumber_key" ON "LoadingOrder"("companyId", "serialNumber");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_companyId_name_key" ON "Role"("companyId", "name");

-- CreateIndex
CREATE INDEX "WorkOrder_companyId_idx" ON "WorkOrder"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_companyId_orderNumber_key" ON "WorkOrder"("companyId", "orderNumber");

-- CreateIndex
CREATE INDEX "WorkOrderPart_companyId_idx" ON "WorkOrderPart"("companyId");

-- CreateIndex
CREATE INDEX "MaintenanceSchedule_companyId_idx" ON "MaintenanceSchedule"("companyId");

-- CreateIndex
CREATE INDEX "VehicleInspection_companyId_idx" ON "VehicleInspection"("companyId");

-- CreateIndex
CREATE INDEX "InspectionItem_companyId_idx" ON "InspectionItem"("companyId");

-- CreateIndex
CREATE INDEX "SparePart_companyId_idx" ON "SparePart"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "SparePart_companyId_partNumber_key" ON "SparePart"("companyId", "partNumber");

-- CreateIndex
CREATE INDEX "SparePartTransaction_companyId_idx" ON "SparePartTransaction"("companyId");

-- CreateIndex
CREATE INDEX "WorkshopExpense_companyId_idx" ON "WorkshopExpense"("companyId");

-- CreateIndex
CREATE INDEX "Department_companyId_idx" ON "Department"("companyId");

-- CreateIndex
CREATE INDEX "Designation_companyId_idx" ON "Designation"("companyId");

-- CreateIndex
CREATE INDEX "Employee_companyId_idx" ON "Employee"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_companyId_employeeNumber_key" ON "Employee"("companyId", "employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_companyId_email_key" ON "Employee"("companyId", "email");

-- CreateIndex
CREATE INDEX "Attendance_companyId_idx" ON "Attendance"("companyId");

-- CreateIndex
CREATE INDEX "LeaveRequest_companyId_idx" ON "LeaveRequest"("companyId");

-- CreateIndex
CREATE INDEX "EmployeeDocument_companyId_idx" ON "EmployeeDocument"("companyId");

-- CreateIndex
CREATE INDEX "EmploymentContract_companyId_idx" ON "EmploymentContract"("companyId");

-- AddForeignKey
ALTER TABLE "Truck" ADD CONSTRAINT "Truck_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruckDriverAssignment" ADD CONSTRAINT "TruckDriverAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargoType" ADD CONSTRAINT "CargoType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateContract" ADD CONSTRAINT "RateContract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadingOrder" ADD CONSTRAINT "LoadingOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderPart" ADD CONSTRAINT "WorkOrderPart_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleInspection" ADD CONSTRAINT "VehicleInspection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionItem" ADD CONSTRAINT "InspectionItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePart" ADD CONSTRAINT "SparePart_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePartTransaction" ADD CONSTRAINT "SparePartTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopExpense" ADD CONSTRAINT "WorkshopExpense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Designation" ADD CONSTRAINT "Designation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- New rows must state their company explicitly (the application always does).
ALTER TABLE "Truck" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "TruckDriverAssignment" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "Driver" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "Supplier" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "Customer" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "Location" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "CargoType" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "Trip" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "RateContract" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "Invoice" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "CompanySettings" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "SupplierPayment" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "LoadingOrder" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "Role" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "WorkOrder" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "WorkOrderPart" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "MaintenanceSchedule" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "VehicleInspection" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "InspectionItem" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "SparePart" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "SparePartTransaction" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "WorkshopExpense" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "Department" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "Designation" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "Employee" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "Attendance" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "LeaveRequest" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "EmployeeDocument" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "EmploymentContract" ALTER COLUMN "companyId" DROP DEFAULT;
