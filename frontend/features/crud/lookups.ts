import { defineLookup } from '../../components/AsyncSelect';
import { cargoTypesApi } from '../../lib/api/cargo-types.api';
import { customersApi } from '../../lib/api/customers.api';
import { driversApi } from '../../lib/api/drivers.api';
import { departmentsApi, designationsApi, employeesApi } from '../../lib/api/hr.api';
import { locationsApi } from '../../lib/api/locations.api';
import { rolesApi } from '../../lib/api/roles.api';
import { suppliersApi } from '../../lib/api/suppliers.api';
import { trucksApi } from '../../lib/api/trucks.api';
import { localizedName } from '../../lib/localized-name';
import type { Option } from './types';

/** The pickable resources, each searched on the server and labelled in the active language. */
export const lookups = {
  trucks: defineLookup({ api: trucksApi, label: (row) => row.truckNumber }),
  drivers: defineLookup({ api: driversApi, label: localizedName }),
  customers: defineLookup({ api: customersApi, label: localizedName }),
  suppliers: defineLookup({ api: suppliersApi, label: localizedName }),
  locations: defineLookup({ api: locationsApi, label: localizedName }),
  cargoTypes: defineLookup({ api: cargoTypesApi, label: localizedName }),
  departments: defineLookup({ api: departmentsApi, label: localizedName }),
  designations: defineLookup({ api: designationsApi, label: localizedName }),
  employees: defineLookup({ api: employeesApi, label: (row, language) => `${localizedName(row, language)} (${row.employeeNumber})` }),
  roles: defineLookup({ api: rolesApi, label: (row) => row.name }),
};

export const ACTIVE_INACTIVE: Option[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];
