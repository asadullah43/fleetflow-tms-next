/**
 * LOCAL DEV ONLY. Fills every module with realistic bulk data by calling
 * the same services the API uses (not raw Prisma inserts), so every
 * create goes through the real business logic: tenant stamping, number
 * sequences (EMP-/WO-/INV-/LDO- series), overlap checks, computed totals.
 * That's what makes the generated rows safe to edit/update/delete through
 * the UI exactly like real data would behave.
 *
 * Run: npm run seed:dev-data   (from backend/)
 *
 * Refuses to run when NODE_ENV=production. Safe to re-run - it only ADDS
 * records (no deletes, no truncation), so running it twice just doubles
 * the counts. If you want a clean slate first, restore from a backup or
 * wipe the dev database yourself; this script never drops anything.
 */
import { config } from '../global_config/index.js';
import { disconnectDatabase, prisma } from '../_core_app_connectivities/prisma.js';
import { runUnscoped, runWithTenant } from '../_core_app_connectivities/tenant-context.js';
import { assignmentsService } from '../services/assignments.service.js';
import { cargoTypesService } from '../services/cargo-types.service.js';
import { customersService } from '../services/customers.service.js';
import { driversService } from '../services/drivers.service.js';
import { attendanceService, departmentsService, designationsService, employeesService, employmentContractsService, leaveRequestsService } from '../services/hr.service.js';
import { invoicesService } from '../services/invoices.service.js';
import { loadingOrdersService } from '../services/loading-orders.service.js';
import { locationsService } from '../services/locations.service.js';
import { rateContractsService } from '../services/rate-contracts.service.js';
import { supplierPaymentsService } from '../services/supplier-payments.service.js';
import { suppliersService } from '../services/suppliers.service.js';
import { tripsService } from '../services/trips.service.js';
import { trucksService } from '../services/trucks.service.js';
import {
  maintenanceSchedulesService,
  sparePartsService,
  sparePartTransactionsService,
  vehicleInspectionsService,
  workOrdersService,
  workshopExpensesService,
} from '../services/workshop.service.js';

if (config.env === 'production') {
  console.error('Refusing to run: NODE_ENV=production. This script is for local/dev databases only.');
  process.exit(1);
}

// ── Tiny deterministic-ish data pool (no new dependency needed) ─────────
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];
const num = (min: number, max: number, seed: number) => min + (seed % (max - min + 1));
const dateOffset = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);

const DRIVER_NAMES = ['Mohammed Al-Harbi', 'Abdullah Al-Qahtani', 'Faisal Al-Otaibi', 'Khalid Al-Mutairi', 'Saeed Al-Ghamdi', 'Nasser Al-Dosari', 'Turki Al-Shehri', 'Bandar Al-Rashid', 'Waleed Al-Amri', 'Fahad Al-Zahrani', 'Majed Al-Subaie', 'Rayan Al-Harthi'];
const CUSTOMER_NAMES = ['Saudi Steel Co.', 'Gulf Cement Industries', 'Al-Rajhi Trading Est.', 'Red Sea Logistics', 'Najd Building Materials', 'Eastern Province Foods', 'Al-Khobar Retail Group', 'Jeddah Import & Export', 'Riyadh Construction Supplies', 'Dammam Marine Services', 'Qassim Agri Products', 'Tabuk Trading Company', 'Madinah Wholesale Mart', 'Yanbu Petrochemical Supply', 'Hail General Trading', 'Abha Mountain Goods', 'Jubail Industrial Partners', 'Taif Rose Exports', 'Al-Ahsa Date Traders', 'Khamis Mushait Freight'];
const SUPPLIER_NAMES = ['Arabian Tire Supplies', 'Gulf Spare Parts Co.', 'National Fuel Distributors', 'Al-Faisaliah Workshop Tools', 'Riyadh Auto Spares', 'Eastern Lubricants Est.', 'Haramain Fleet Services', 'Jeddah Heavy Equipment'];
const LOCATIONS = ['Riyadh Warehouse', 'Jeddah Port', 'Dammam Industrial City', 'Jubail Logistics Hub', 'Yanbu Terminal', 'Madinah Distribution Center', 'Khobar Depot', 'Qassim Dry Port', 'Abha Cold Storage', 'Tabuk Transit Yard'];
const CARGO_TYPES = ['Steel Coils', 'Cement Bags', 'General Cargo', 'Refrigerated Goods', 'Bulk Grain', 'Construction Aggregate'];
const DEPARTMENTS = ['Operations', 'Fleet Maintenance', 'Finance', 'Human Resources', 'Sales & Customer Relations'];
const DESIGNATIONS_BY_DEPT: Record<string, string[]> = {
  Operations: ['Operations Manager', 'Dispatcher', 'Logistics Coordinator'],
  'Fleet Maintenance': ['Workshop Supervisor', 'Mechanic', 'Inspector'],
  Finance: ['Accountant', 'Finance Manager'],
  'Human Resources': ['HR Officer', 'Recruiter'],
  'Sales & Customer Relations': ['Sales Executive', 'Account Manager'],
};
const EMPLOYEE_NAMES = ['Omar Al-Fahad', 'Yousef Al-Dossari', 'Hassan Al-Malki', 'Sultan Al-Anazi', 'Ibrahim Al-Juhani', 'Ziad Al-Qurashi', 'Hamad Al-Suwaidi', 'Talal Al-Yami', 'Sami Al-Khaldi', 'Rashed Al-Nefaie', 'Adel Al-Marri', 'Fawaz Al-Thaqafi', 'Nawaf Al-Saleh', 'Hussain Al-Bishi', 'Amjad Al-Rawahi', 'Salman Al-Hazmi', 'Ahmed Al-Qurni', 'Mansour Al-Shahrani', 'Yazeed Al-Harith', 'Dawood Al-Fayez'];

async function main() {
  const company = await runUnscoped(() => prisma.company.findFirst({ orderBy: { id: 'asc' } }));
  if (!company) {
    console.error('No company found - run the base seed first: npm run seed  (or npm run prisma:generate / db setup if this is a fresh database).');
    process.exit(1);
  }
  console.log(`Seeding dev data into company #${company.id} (${company.name})...`);

  await runWithTenant(company.id, async () => {
    // Vehicle inspections are signed off by a User (inspectorId -> User),
    // not a Driver - use whichever users already exist (at least the admin).
    const users = await prisma.user.findMany({ select: { id: true } });

    // ── Master data (no dependencies) ────────────────────────────────
    const trucks = [];
    for (let i = 1; i <= 15; i++) trucks.push(await trucksService.create({ truckNumber: `TRK-${String(i).padStart(3, '0')}`, truckType: pick(['Flatbed', 'Reefer', 'Box Truck', 'Tanker', 'Lowboy'], i), status: 'ACTIVE' }));

    const drivers = [];
    for (let i = 0; i < 12; i++) drivers.push(await driversService.create({ name: DRIVER_NAMES[i], phone: `05${num(10000000, 99999999, i)}`, licenseNo: `DL-${String(i + 1).padStart(5, '0')}`, idNumber: `${num(1000000000, 1099999999, i)}`, status: 'ACTIVE' }));

    const customers = [];
    for (let i = 0; i < 20; i++) customers.push(await customersService.create({ name: CUSTOMER_NAMES[i], contactPerson: pick(EMPLOYEE_NAMES, i + 3), phone: `01${num(1000000, 9999999, i)}`, email: `contact${i + 1}@${CUSTOMER_NAMES[i].toLowerCase().replace(/[^a-z]+/g, '')}.sa`, city: pick(['Riyadh', 'Jeddah', 'Dammam', 'Khobar', 'Mecca'], i), country: 'SA', vatNumber: `3${num(100000000000000, 399999999999999, i)}`, status: 'ACTIVE' }));

    const suppliers = [];
    for (let i = 0; i < 8; i++) suppliers.push(await suppliersService.create({ name: SUPPLIER_NAMES[i], contactPerson: pick(EMPLOYEE_NAMES, i + 7), phone: `01${num(1000000, 9999999, i + 50)}`, email: `info${i + 1}@${SUPPLIER_NAMES[i].toLowerCase().replace(/[^a-z]+/g, '')}.sa`, status: 'ACTIVE' }));

    const locations = [];
    for (let i = 0; i < LOCATIONS.length; i++) locations.push(await locationsService.create({ name: LOCATIONS[i], description: `${LOCATIONS[i]} - primary loading/unloading point`, status: 'ACTIVE' }));

    const cargoTypes = [];
    for (let i = 0; i < CARGO_TYPES.length; i++) cargoTypes.push(await cargoTypesService.create({ name: CARGO_TYPES[i], pricingMode: pick(['PER_MT', 'PER_TRIP'], i), status: 'ACTIVE' }));

    // ── HR structure ──────────────────────────────────────────────────
    const departments: Record<string, any> = {};
    for (const name of DEPARTMENTS) departments[name] = await departmentsService.create({ name, status: 'ACTIVE' });

    const designations: any[] = [];
    for (const [deptName, titles] of Object.entries(DESIGNATIONS_BY_DEPT)) {
      for (const title of titles) designations.push(await designationsService.create({ name: title, departmentId: departments[deptName].id, status: 'ACTIVE' }));
    }

    const employees = [];
    for (let i = 0; i < EMPLOYEE_NAMES.length; i++) {
      const deptName = pick(DEPARTMENTS, i);
      const deptDesignations = designations.filter((d) => d.departmentId === departments[deptName].id);
      employees.push(
        await employeesService.create({
          name: EMPLOYEE_NAMES[i],
          email: `${EMPLOYEE_NAMES[i].toLowerCase().replace(/[^a-z ]+/g, '').replace(/ +/g, '.')}@fleetflow-dev.sa`,
          phone: `05${num(10000000, 99999999, i + 100)}`,
          joiningDate: dateOffset(-num(30, 900, i)),
          employmentType: 'FULL_TIME',
          employmentStatus: 'ACTIVE',
          departmentId: departments[deptName].id,
          designationId: pick(deptDesignations, i).id,
          salary: String(num(4000, 15000, i * 7)),
        }),
      );
    }

    // ── Assignments (truck <-> driver) ──────────────────────────────
    for (let i = 0; i < 12; i++) {
      try {
        await assignmentsService.create({ truckId: trucks[i].id, driverId: drivers[i].id, startDate: dateOffset(-num(10, 60, i)) });
      } catch {
        // overlap for this truck/day combo - skip, not essential for bulk test data
      }
    }

    // ── Rate contracts (unique per customer+pickup+delivery+cargo) ──
    for (let i = 0; i < 15; i++) {
      const c = pick(customers, i);
      const pickup = pick(locations, i);
      const delivery = pick(locations, i + 3);
      if (pickup.id === delivery.id) continue;
      try {
        await rateContractsService.create({ customerId: c.id, pickupLocationId: pickup.id, deliveryLocationId: delivery.id, cargoTypeId: pick(cargoTypes, i).id, rate: String(num(500, 5000, i * 3)), currency: 'SAR' });
      } catch {
        // duplicate combo for this customer - skip
      }
    }

    // ── Trips (the central transaction record) ───────────────────────
    const trips = [];
    for (let i = 1; i <= 40; i++) {
      const pickup = pick(locations, i);
      const delivery = pick(locations, i + 4);
      if (pickup.id === delivery.id) continue;
      trips.push(
        await tripsService.create({
          transactionNumber: `TRP-${String(i).padStart(4, '0')}`,
          customerId: pick(customers, i).id,
          pickupLocationId: pickup.id,
          deliveryLocationId: delivery.id,
          cargoTypeId: pick(cargoTypes, i).id,
          quantity: String(num(5, 40, i * 2)),
          tripDate: dateOffset(-num(0, 45, i)),
          truckId: pick(trucks, i).id,
        }),
      );
    }

    // ── Invoices (with line items; totals computed by the service) ──
    for (let i = 0; i < 15; i++) {
      await invoicesService.create({
        customerId: pick(customers, i).id,
        dueDate: dateOffset(30),
        fromDate: dateOffset(-30),
        toDate: dateOffset(0),
        currency: 'SAR',
        vatEnabled: true,
        vatPercent: '15',
        lineItems: [
          { description: `Freight services - ${pick(CARGO_TYPES, i)}`, quantity: String(num(1, 10, i)), rate: String(num(200, 2000, i * 5)) },
          { description: 'Handling charges', quantity: '1', rate: String(num(50, 300, i * 2)) },
        ],
      });
    }

    // ── Loading order batches ─────────────────────────────────────────
    for (let i = 0; i < 5; i++) {
      const pickup = pick(locations, i + 1);
      const delivery = pick(locations, i + 6);
      if (pickup.id === delivery.id) continue;
      await loadingOrdersService.create({ pickupLocationId: pickup.id, deliveryLocationId: delivery.id, customerId: pick(customers, i + 2).id, cargoTypeId: pick(cargoTypes, i + 1).id, quantity: num(2, 5, i) });
    }

    // ── Supplier payments ──────────────────────────────────────────────
    for (let i = 0; i < 10; i++) await supplierPaymentsService.create({ supplierId: pick(suppliers, i).id, amount: String(num(500, 8000, i * 4)), currency: 'SAR', paymentDate: dateOffset(-num(0, 30, i)), description: 'Spare parts / fuel settlement' });

    // ── Workshop ───────────────────────────────────────────────────────
    const spareParts = [];
    const PART_NAMES = ['Brake Pads', 'Oil Filter', 'Air Filter', 'Tyre 295/80R22.5', 'Clutch Plate', 'Fuel Injector', 'Alternator', 'Radiator Hose', 'Shock Absorber', 'Battery 12V', 'Headlight Assembly', 'Windscreen Wiper', 'Fan Belt', 'Brake Disc', 'Suspension Bushing'];
    for (let i = 0; i < PART_NAMES.length; i++) spareParts.push(await sparePartsService.create({ name: PART_NAMES[i], partNumber: `SP-${String(i + 1).padStart(4, '0')}`, category: pick(['Engine', 'Brakes', 'Electrical', 'Tyres', 'Body'], i), quantity: num(5, 100, i), minimumStock: 10, unitCost: String(num(30, 1200, i * 6)), supplierId: pick(suppliers, i).id, status: 'ACTIVE' }));

    for (let i = 0; i < 10; i++) await sparePartTransactionsService.create({ sparePartId: pick(spareParts, i).id, transactionType: pick(['IN', 'OUT'], i), quantity: num(1, 10, i), referenceNote: 'Dev seed stock movement' });

    for (let i = 0; i < 15; i++) {
      await workOrdersService.create({
        truckId: pick(trucks, i).id,
        driverId: pick(drivers, i).id,
        issue: pick(['Engine overheating', 'Brake noise', 'Tyre puncture', 'AC not cooling', 'Electrical fault', 'Suspension noise'], i),
        priority: pick(['LOW', 'MEDIUM', 'HIGH'], i),
        status: pick(['OPEN', 'IN_PROGRESS', 'COMPLETED'], i),
        startDate: dateOffset(-num(0, 20, i)),
        laborCost: String(num(100, 800, i * 3)),
        partsCost: String(num(50, 500, i * 2)),
      });
    }

    for (let i = 0; i < 10; i++) await maintenanceSchedulesService.create({ truckId: pick(trucks, i).id, maintenanceType: pick(['Oil Change', 'Tyre Rotation', 'Full Service', 'Brake Inspection'], i), mileageInterval: '10000', status: 'ACTIVE' });

    for (let i = 0; i < 15; i++) await vehicleInspectionsService.create({ truckId: pick(trucks, i).id, inspectorId: pick(users, i).id, inspectDate: dateOffset(-num(0, 15, i)), odometer: String(num(10000, 200000, i * 11)), result: pick(['PASS', 'FAIL', 'PASS'], i) });

    for (let i = 0; i < 10; i++) await workshopExpensesService.create({ truckId: pick(trucks, i).id, category: pick(['Fuel', 'Tyres', 'Parts', 'Labor', 'Insurance'], i), amount: String(num(100, 3000, i * 5)), expenseDate: dateOffset(-num(0, 30, i)) });

    // ── HR: attendance, leave, contracts ───────────────────────────────
    for (const emp of employees) {
      for (let d = 0; d < 5; d++) {
        try {
          await attendanceService.create({ employeeId: emp.id, attendDate: dateOffset(-d), status: pick(['PRESENT', 'PRESENT', 'PRESENT', 'LATE'], d), hoursWorked: '8' });
        } catch {
          // duplicate employee+date - skip
        }
      }
    }
    for (let i = 0; i < 6; i++) await leaveRequestsService.create({ employeeId: pick(employees, i).id, leaveType: pick(['ANNUAL', 'SICK', 'UNPAID'], i), startDate: dateOffset(5 + i), endDate: dateOffset(8 + i), days: 3, reason: 'Dev seed test leave', status: 'PENDING' });
    for (const emp of employees) await employmentContractsService.create({ employeeId: emp.id, contractNumber: `CTR-${String(emp.id).padStart(5, '0')}`, contractType: 'FULL_TIME', startDate: dateOffset(-180), salary: String(num(4000, 15000, emp.id * 7)), currency: 'SAR', status: 'ACTIVE' });

    console.log('Dev data seeded:');
    console.log(`  Trucks: ${trucks.length}, Drivers: ${drivers.length}, Customers: ${customers.length}, Suppliers: ${suppliers.length}`);
    console.log(`  Locations: ${locations.length}, Cargo types: ${cargoTypes.length}, Trips: ${trips.length}, Spare parts: ${spareParts.length}`);
    console.log(`  Departments: ${Object.keys(departments).length}, Designations: ${designations.length}, Employees: ${employees.length}`);
    console.log('Invoices, loading orders, supplier payments, work orders, maintenance schedules, inspections, workshop expenses, attendance, leave requests and employment contracts were also seeded.');
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
