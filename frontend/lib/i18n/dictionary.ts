/**
 * English → Arabic lookup for the app's shared UI chrome. Deliberately a
 * "translate by exact English string" dictionary rather than per-string
 * keys scattered through every page: the app's ~25 module pages all flow
 * their titles, descriptions, column headers and field labels through a
 * handful of shared components (AppShell, CrudPage, CrudPanel, nav-config)
 * as plain English literals, so wrapping those render sites with `t()`
 * and populating this one dictionary translates the whole app's chrome
 * without rewriting every page into a translation-key scheme.
 *
 * Anything not listed here just falls back to the original English text
 * (see `translate` below) — safe for whatever hasn't been added yet, and
 * makes this dictionary purely additive to extend later.
 */
export const AR_STRINGS: Record<string, string> = {
  // ── Sidebar nav groups & items ───────────────────────────
  Dashboard: 'لوحة التحكم',
  Operations: 'العمليات',
  Trips: 'الرحلات',
  'Loading Orders': 'أوامر التحميل',
  Accounts: 'الحسابات',
  Invoices: 'الفواتير',
  'Supplier Payments': 'مدفوعات الموردين',
  Workshop: 'الورشة',
  'Work Orders': 'أوامر العمل',
  Maintenance: 'الصيانة',
  Inspections: 'الفحوصات',
  Expenses: 'المصروفات',
  Inventory: 'المخزون',
  'Master Data': 'البيانات الأساسية',
  Trucks: 'الشاحنات',
  Drivers: 'السائقون',
  'Truck-Driver Assignments': 'تعيينات الشاحنة والسائق',
  Suppliers: 'الموردون',
  Customers: 'العملاء',
  Locations: 'المواقع',
  'Cargo Types': 'أنواع البضائع',
  'Rate Contracts': 'عقود الأسعار',
  'Human Resources': 'الموارد البشرية',
  Departments: 'الأقسام',
  Designations: 'المسميات الوظيفية',
  Employees: 'الموظفون',
  Attendance: 'الحضور',
  'Leave Requests': 'طلبات الإجازة',
  Documents: 'المستندات',
  Contracts: 'العقود',
  Administration: 'الإدارة',
  Users: 'المستخدمون',
  Roles: 'الأدوار',
  'Company Settings': 'إعدادات الشركة',
  ZATCA: 'هيئة الزكاة والضريبة (زاتكا)',

  // ── Dashboard tabs & stats ────────────────────────────────
  'HR Dashboard': 'لوحة الموارد البشرية',
  'Workshop Dashboard': 'لوحة الورشة',
  Map: 'الخريطة',
  'Active trucks': 'الشاحنات النشطة',
  'Active drivers': 'السائقون النشطون',
  'Trips (MTD)': 'الرحلات (منذ بداية الشهر)',
  'Open work orders': 'أوامر العمل المفتوحة',
  'On leave': 'في إجازة',

  // ── Page titles ───────────────────────────────────────────
  'New invoice': 'فاتورة جديدة',

  // ── Page descriptions ─────────────────────────────────────
  'Manage which driver is assigned to which truck, and for how long.':
    'إدارة السائق المعيّن لكل شاحنة، ومدة التعيين.',
  'Manage your fleet vehicles, maintenance schedules, and truck assignments.':
    'إدارة مركبات الأسطول وجداول الصيانة وتعيينات الشاحنات.',
  'Manage vendors and service providers you buy fuel, parts, and services from.':
    'إدارة الموردين ومقدمي الخدمات الذين تشتري منهم الوقود وقطع الغيار والخدمات.',
  'Manage your driver roster, licenses, and availability status.':
    'إدارة قائمة السائقين ورخصهم وحالة توفرهم.',
  'Spare parts stock levels, reorder thresholds, and unit cost.':
    'مستويات مخزون قطع الغيار وحدود إعادة الطلب وتكلفة الوحدة.',
  'Manage the customers you move cargo for, and their billing details.':
    'إدارة العملاء الذين تنقل البضائع لهم وتفاصيل الفوترة الخاصة بهم.',
  'Manage the kinds of cargo you haul and how each is priced.':
    'إدارة أنواع البضائع التي تنقلها وكيفية تسعير كل نوع.',
  'Manage pickup and delivery points used when scheduling trips.':
    'إدارة نقاط الاستلام والتسليم المستخدمة عند جدولة الرحلات.',
  'Manage negotiated per-customer rates for a route and cargo type.':
    'إدارة الأسعار المتفاوض عليها لكل عميل حسب خط السير ونوع البضاعة.',

  // ── Add-record labels ─────────────────────────────────────
  Assignment: 'تعيين',
  Payment: 'دفعة',
  Truck: 'شاحنة',
  Supplier: 'مورد',
  Customer: 'عميل',
  'Cargo Type': 'نوع البضاعة',
  Location: 'موقع',
  Document: 'مستند',
  Contract: 'عقد',
  Designation: 'المسمى الوظيفي',
  Department: 'القسم',
  'Leave Request': 'طلب إجازة',
  Employee: 'موظف',
  Trip: 'رحلة',
  User: 'مستخدم',
  'Rate Contract': 'عقد سعر',
  Driver: 'سائق',
  'Spare Part': 'قطعة غيار',
  'Work Order': 'أمر عمل',
  Inspection: 'فحص',
  'Maintenance Schedule': 'جدول صيانة',
  Expense: 'مصروف',

  // ── Search placeholders ────────────────────────────────────
  'Truck or driver': 'الشاحنة أو السائق',
  'Truck number': 'رقم الشاحنة',
  'Supplier name': 'اسم المورد',
  'Customer name': 'اسم العميل',
  'Cargo type name': 'اسم نوع البضاعة',
  'Location name': 'اسم الموقع',
  'Driver name': 'اسم السائق',
  'Customer, route, or cargo': 'العميل أو خط السير أو البضاعة',

  // ── Empty-state messages ───────────────────────────────────
  'No assignments yet — assign a driver to a truck to start tracking runs.':
    'لا توجد تعيينات بعد — عيّن سائقًا لشاحنة لبدء تتبّع الرحلات.',
  'No supplier payments recorded yet.': 'لا توجد مدفوعات موردين مسجّلة بعد.',
  'No trucks yet — add your first vehicle to start scheduling trips.':
    'لا توجد شاحنات بعد — أضف أول مركبة لبدء جدولة الرحلات.',
  'No suppliers yet.': 'لا يوجد موردون بعد.',
  'No customers yet.': 'لا يوجد عملاء بعد.',
  'No cargo types yet.': 'لا توجد أنواع بضائع بعد.',
  'No locations yet — add pickup and delivery points to use them on trips.':
    'لا توجد مواقع بعد — أضف نقاط استلام وتسليم لاستخدامها في الرحلات.',
  'No employee documents yet.': 'لا توجد مستندات موظفين بعد.',
  'No employment contracts yet.': 'لا توجد عقود عمل بعد.',
  'No designations yet.': 'لا توجد مسميات وظيفية بعد.',
  'No departments yet.': 'لا توجد أقسام بعد.',
  'No leave requests yet.': 'لا توجد طلبات إجازة بعد.',
  'No employees yet.': 'لا يوجد موظفون بعد.',
  'No attendance records yet.': 'لا توجد سجلات حضور بعد.',
  'No trips yet — record a run once a truck picks up a load.':
    'لا توجد رحلات بعد — سجّل رحلة بمجرد أن تستلم شاحنة حمولة.',
  'No users yet.': 'لا يوجد مستخدمون بعد.',
  'No negotiated rates yet.': 'لا توجد أسعار متفاوض عليها بعد.',
  'No drivers yet.': 'لا يوجد سائقون بعد.',
  'No spare parts in inventory yet.': 'لا توجد قطع غيار في المخزون بعد.',
  'No work orders yet.': 'لا توجد أوامر عمل بعد.',
  'No inspections recorded yet.': 'لا توجد فحوصات مسجّلة بعد.',
  'No maintenance schedules yet.': 'لا توجد جداول صيانة بعد.',
  'No workshop expenses recorded yet.': 'لا توجد مصروفات ورشة مسجّلة بعد.',
  'No matching records.': 'لا توجد سجلات مطابقة.',
  'No assignment history yet.': 'لا يوجد سجل تعيينات بعد.',

  // ── Field labels & column headers ──────────────────────────
  'Start date': 'تاريخ البدء',
  'End date (leave blank if ongoing)': 'تاريخ الانتهاء (اتركه فارغًا إذا كان مستمرًا)',
  'End date': 'تاريخ الانتهاء',
  Start: 'البداية',
  End: 'النهاية',
  Amount: 'المبلغ',
  Currency: 'العملة',
  'Payment date': 'تاريخ الدفع',
  Description: 'الوصف',
  Date: 'التاريخ',
  'Truck type': 'نوع الشاحنة',
  Type: 'النوع',
  Status: 'الحالة',
  Active: 'نشط',
  Inactive: 'غير نشط',
  Low: 'منخفض',
  Medium: 'متوسط',
  High: 'مرتفع',
  Urgent: 'عاجل',
  Open: 'مفتوح',
  'In progress': 'قيد التنفيذ',
  Completed: 'مكتمل',
  Cancelled: 'ملغى',
  'Order #': 'رقم الأمر',
  'Workshop / supplier': 'الورشة / المورد',
  Issue: 'المشكلة',
  Diagnosis: 'التشخيص',
  Priority: 'الأولوية',
  'Labor cost': 'تكلفة العمالة',
  'Parts cost': 'تكلفة القطع',
  'Other cost': 'تكاليف أخرى',
  'Total cost': 'التكلفة الإجمالية',
  Notes: 'ملاحظات',
  Name: 'الاسم',
  'Language of name above': 'لغة الاسم أعلاه',
  'Language of name/description above': 'لغة الاسم/الوصف أعلاه',
  English: 'الإنجليزية',
  Arabic: 'العربية',
  Language: 'اللغة',
  'Contact person': 'جهة الاتصال',
  Contact: 'جهة الاتصال',
  Phone: 'الهاتف',
  Email: 'البريد الإلكتروني',
  Pass: 'ناجح',
  Fail: 'راسب',
  Result: 'النتيجة',
  'Inspector (user ID)': 'المفتش (معرّف المستخدم)',
  'Inspection date': 'تاريخ الفحص',
  Done: 'منجَز',
  Overdue: 'متأخر',
  'Maintenance type': 'نوع الصيانة',
  'Last service date': 'تاريخ آخر صيانة',
  'Next service date': 'تاريخ الصيانة القادمة',
  'Next service': 'الصيانة القادمة',
  'License number': 'رقم الرخصة',
  'License no.': 'رقم الرخصة',
  'ID number': 'رقم الهوية',
  Category: 'الفئة',
  'Expense date': 'تاريخ المصروف',
  Discontinued: 'متوقف',
  'Part #': 'رقم القطعة',
  'Part number': 'رقم القطعة',
  Qty: 'الكمية',
  'Quantity in stock': 'الكمية في المخزون',
  'Minimum stock level': 'الحد الأدنى للمخزون',
  'Min stock': 'الحد الأدنى للمخزون',
  'Unit cost': 'تكلفة الوحدة',
  'VAT number': 'الرقم الضريبي',
  'CR number': 'رقم السجل التجاري',
  City: 'المدينة',
  Country: 'الدولة',
  Street: 'الشارع',
  'Street name': 'اسم الشارع',
  'Building number': 'رقم المبنى',
  'Postal code': 'الرمز البريدي',
  Address: 'العنوان',
  'Fixed term': 'محدد المدة',
  Unlimited: 'غير محدد المدة',
  Expired: 'منتهي',
  Terminated: 'منتهي الخدمة',
  'Contract #': 'رقم العقد',
  'Contract number': 'رقم العقد',
  'Contract type': 'نوع العقد',
  Salary: 'الراتب',
  Pending: 'قيد الانتظار',
  Approved: 'موافَق عليه',
  Rejected: 'مرفوض',
  'Leave type': 'نوع الإجازة',
  'Number of days': 'عدد الأيام',
  Reason: 'السبب',
  'Employee #': 'رقم الموظف',
  'Full time': 'دوام كامل',
  'Part time': 'دوام جزئي',
  'Employment type': 'نوع التوظيف',
  'Joining date': 'تاريخ الالتحاق',
  'Full name': 'الاسم الكامل',
  Username: 'اسم المستخدم',
  'Password (leave blank to keep unchanged when editing)': 'كلمة المرور (اتركها فارغة للإبقاء عليها دون تغيير عند التعديل)',
  Role: 'الدور',
  'Document Type': 'نوع المستند',
  'Document type': 'نوع المستند',
  'Document number': 'رقم المستند',
  'Issue date': 'تاريخ الإصدار',
  'Expiry date': 'تاريخ الانتهاء',
  Expiry: 'تاريخ الانتهاء',
  'File URL': 'رابط الملف',
  'Pricing mode': 'طريقة التسعير',
  'Per metric ton': 'لكل طن متري',
  'Per trip': 'لكل رحلة',
  'Company name': 'اسم الشركة',
  'Branch name': 'اسم الفرع',
  'Industry category': 'نوع النشاط',
  'Bank name': 'اسم البنك',
  'Bank account (IBAN)': 'رقم الحساب البنكي (آيبان)',
  'From Date': 'من تاريخ',
  'To Date': 'إلى تاريخ',
  From: 'من',
  To: 'إلى',
  'Transaction #': 'رقم المعاملة',
  'Pickup Location': 'موقع الاستلام',
  'Delivery Location': 'موقع التسليم',
  'Pickup location': 'موقع الاستلام',
  'Delivery location': 'موقع التسليم',
  'Cargo type': 'نوع البضاعة',
  Quantity: 'الكمية',
  'Trip date': 'تاريخ الرحلة',
  'Assigned driver': 'السائق المعيّن',
  Rate: 'السعر',
  Route: 'خط السير',
  Cargo: 'البضاعة',
  Present: 'حاضر',
  Absent: 'غائب',
  Late: 'متأخر',
  'Half day': 'نصف يوم',
  Level: 'المستوى',
  'Arabic name': 'الاسم بالعربية',

  // ── Shared CrudPanel chrome ─────────────────────────────────
  Search: 'بحث',
  'Clear filters': 'مسح الفلاتر',
  Excel: 'إكسل',
  PDF: 'ملف PDF',
  'Select...': 'اختر...',
  'Search...': 'بحث...',
  'Loading...': 'جارٍ التحميل...',
  Actions: 'الإجراءات',
  'View history': 'عرض السجل',
  Edit: 'تعديل',
  Delete: 'حذف',
  Cancel: 'إلغاء',
  Save: 'حفظ',
  'Saving...': 'جارٍ الحفظ...',
  'Delete this record? This cannot be undone.': 'هل تريد حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.',
  'Open PDF': 'فتح PDF',
  'Delete batch': 'حذف الدفعة',

  // ── AppShell topbar ───────────────────────────────────────
  'Sign out': 'تسجيل الخروج',
  Close: 'إغلاق',

  // ── Login screen ──────────────────────────────────────────
  'Sign in': 'تسجيل الدخول',
  'Signing in...': 'جارٍ تسجيل الدخول...',
  Password: 'كلمة المرور',
  'Use your {company} credentials.': 'استخدم بيانات اعتماد {company} الخاصة بك.',
  'Every trip, every truck, one screen.': 'كل رحلة، كل شاحنة، على شاشة واحدة.',
  'Trucking · Logistics · Operations': 'النقل · الخدمات اللوجستية · العمليات',

  // ── Dashboard tab content ───────────────────────────────────
  'Loading fleet summary...': 'جارٍ تحميل ملخص الأسطول...',
  'Loading HR summary...': 'جارٍ تحميل ملخص الموارد البشرية...',
  'Loading workshop summary...': 'جارٍ تحميل ملخص الورشة...',
  'Loading fleet...': 'جارٍ تحميل الأسطول...',
  'Trips this month': 'الرحلات هذا الشهر',
  'Unpaid invoices': 'الفواتير غير المسددة',
  'Pending leave requests': 'طلبات الإجازة المعلّقة',
  'Low stock spare parts': 'قطع الغيار منخفضة المخزون',
  'This month at a glance': 'نظرة سريعة على هذا الشهر',
  'Active fleet & operational load, side by side.': 'الأسطول النشط والحمل التشغيلي، جنبًا إلى جنب.',
  'Needs attention': 'يحتاج إلى انتباه',
  'Open items pulled from across the fleet.': 'عناصر مفتوحة من مختلف أنحاء الأسطول.',
  'Open items pulled from the workshop.': 'عناصر مفتوحة من الورشة.',
  'Nothing outstanding right now.': 'لا يوجد شيء معلّق حاليًا.',
  'Total employees': 'إجمالي الموظفين',
  'Present today': 'الحاضرون اليوم',
  'Absent / late today': 'الغائبون / المتأخرون اليوم',
  'Contracts expiring (30d)': 'عقود تنتهي خلال (30 يومًا)',
  'Headcount by department': 'عدد الموظفين حسب القسم',
  'Where the active roster sits today.': 'توزيع الكادر الحالي اليوم.',
  'No employees recorded yet.': 'لا يوجد موظفون مسجّلون بعد.',
  'Workforce status': 'حالة القوى العاملة',
  'Active, on leave, and terminated employees.': 'الموظفون النشطون، في إجازة، ومنتهو الخدمة.',
  'Completed this month': 'المكتمل هذا الشهر',
  'Overdue maintenance': 'صيانة متأخرة',
  'Failed inspections': 'فحوصات فاشلة',
  'Expenses this month': 'مصروفات هذا الشهر',
  'Open work by priority': 'الأعمال المفتوحة حسب الأولوية',
  'Jobs not yet completed or cancelled.': 'أعمال لم تُستكمل أو تُلغَ بعد.',
  'Nothing open right now.': 'لا يوجد عمل مفتوح حاليًا.',
  'Fleet size': 'حجم الأسطول',
  'Live positions': 'المواقع الحيّة',
  'Live tracker not connected yet': 'متتبّع الموقع الحي غير متصل بعد',
  'This is where the real-time GPS positions of your trucks will show up once a tracking provider is wired in — pins moving on the map, trip routes, and geofence alerts.':
    'هنا ستظهر مواقع شاحناتك عبر نظام تحديد المواقع (GPS) بشكل لحظي بمجرد ربط مزوّد تتبع — دبابيس متحركة على الخريطة، وخطوط سير الرحلات، وتنبيهات النطاق الجغرافي.',
  'Fleet roster': 'قائمة الأسطول',
  'Trucks that will appear on the map once tracking is connected.': 'الشاحنات التي ستظهر على الخريطة بمجرد ربط التتبع.',
  'No trucks recorded yet.': 'لا توجد شاحنات مسجّلة بعد.',
  'Welcome back,': 'أهلاً بعودتك،',
  'Role:': 'الدور:',
  'Language:': 'اللغة:',
  None: 'لا يوجد',

  // ── Invoices page ───────────────────────────────────────────
  '+ Invoice': '+ فاتورة',
  'No invoices yet.': 'لا توجد فواتير بعد.',
  'Invoice #': 'رقم الفاتورة',
  Due: 'الاستحقاق',
  Total: 'الإجمالي',
  'Create invoice': 'إنشاء فاتورة',
  'From date': 'من تاريخ',
  'To date': 'إلى تاريخ',
  'Due date': 'تاريخ الاستحقاق',
  'Apply 15% VAT': 'تطبيق ضريبة القيمة المضافة 15%',
  'Line items': 'بنود الفاتورة',
  '+ Add line': '+ إضافة بند',
  'Subtotal:': 'المجموع الفرعي:',
  'VAT:': 'الضريبة:',
  'Total:': 'الإجمالي:',
  'Mark as paid': 'تمييز كمدفوعة',
  'Submit to ZATCA': 'إرسال إلى هيئة الزكاة والضريبة',
  'Customer:': 'العميل:',
  'Due:': 'الاستحقاق:',
  'Status:': 'الحالة:',
  'ZATCA:': 'هيئة الزكاة والضريبة:',
  'ZATCA QR (base64 TLV):': 'رمز الاستجابة السريعة لهيئة الزكاة (TLV بترميز base64):',

  // ── Roles page ────────────────────────────────────────────
  '+ Role': '+ دور',
  'No roles yet.': 'لا توجد أدوار بعد.',
  'Modules with access': 'الوحدات التي لديها صلاحية وصول',
  'Add role': 'إضافة دور',
  'Role name': 'اسم الدور',
  Permissions: 'الصلاحيات',
  Module: 'الوحدة',
  View: 'عرض',
  Add: 'إضافة',

  // ── Truck detail page ──────────────────────────────────────
  '← Back to Trucks': '← العودة إلى الشاحنات',
  'Current driver': 'السائق الحالي',
  Unassigned: 'غير معيّن',
  Ongoing: 'مستمر',
  'No driver currently assigned.': 'لا يوجد سائق معيّن حاليًا.',
  'Assign a driver': 'تعيين سائق',
  'Start a new assignment for this truck.': 'ابدأ تعيينًا جديدًا لهذه الشاحنة.',
  'Assign driver': 'تعيين السائق',
  'Every driver this truck has been assigned to, most recent first.': 'كل سائق تم تعيينه لهذه الشاحنة، الأحدث أولًا.',
  'No assignments yet.': 'لا توجد تعيينات بعد.',
  'Current since': 'حالي منذ',
  Upcoming: 'قادم',
  Remove: 'إزالة',
  'Truck details': 'تفاصيل الشاحنة',
  'Edit assignment': 'تعديل التعيين',

  // ── Roles page: formatModule() output (PERMISSION_MODULES) ─
  Assignments: 'التعيينات',
  Hr: 'الموارد البشرية',

  // ── Bilingual name/description field labels ─────────────────
  'Name (English)': 'الاسم (بالإنجليزية)',
  'Name (Arabic)': 'الاسم (بالعربية)',
  'Description (English)': 'الوصف (بالإنجليزية)',
  'Description (Arabic)': 'الوصف (بالعربية)',
  'Full name (English)': 'الاسم الكامل (بالإنجليزية)',
  'Full name (Arabic)': 'الاسم الكامل (بالعربية)',

  // ── Dashboard: pluralized alert-text fragments ───────────────
  'spare part': 'قطعة غيار',
  'spare parts': 'قطع غيار',
  'at or below minimum stock': 'عند الحد الأدنى للمخزون أو أقل منه',
  'unpaid invoice': 'فاتورة غير مسددة',
  'unpaid invoices': 'فواتير غير مسددة',
  totalling: 'بإجمالي',
  'leave request': 'طلب إجازة',
  'leave requests': 'طلبات إجازة',
  'awaiting approval': 'بانتظار الموافقة',
  'work order': 'أمر عمل',
  'work orders': 'أوامر عمل',
  'open or in progress': 'مفتوح أو قيد التنفيذ',
  'maintenance schedule': 'جدول صيانة',
  'maintenance schedules': 'جداول صيانة',
  'past due': 'متأخر عن موعده',
  'failed inspection': 'فحص فاشل',
  'failed inspections': 'فحوصات فاشلة',
  'on record': 'مسجّل',
  SAR: 'ريال سعودي',

  // ── Workshop list pages: descriptions ────────────────────────
  'Workshop spend per truck — parts, labor, and other repair costs.':
    'مصروفات الورشة لكل شاحنة — القطع، العمالة، وتكاليف الإصلاح الأخرى.',
  'Pass/fail vehicle inspection records per truck.': 'سجلات فحص المركبات (ناجح/راسب) لكل شاحنة.',
  'Scheduled service per truck — last and next due dates.': 'الصيانة المجدولة لكل شاحنة — تواريخ آخر وأقرب صيانة.',

  // ── Company settings page ────────────────────────────────────
  'Company logo': 'شعار الشركة',
  'No logo': 'لا يوجد شعار',
  'Replace logo': 'استبدال الشعار',
  'Upload logo': 'رفع شعار',
  'PNG or JPG. Shown in the sidebar, login screen, and printed documents.':
    'بصيغة PNG أو JPG. يظهر في الشريط الجانبي، شاشة الدخول، والمستندات المطبوعة.',
  'Save changes': 'حفظ التغييرات',
  'Saved.': 'تم الحفظ.',
  'Please choose an image file.': 'يرجى اختيار ملف صورة.',
  'That image is larger than 5 MB — choose a smaller file.': 'هذه الصورة أكبر من 5 ميغابايت — اختر ملفًا أصغر.',
  'Could not process that image.': 'تعذّرت معالجة هذه الصورة.',
  'Save failed.': 'فشل الحفظ.',

  // ── Pages/strings found missing by the dictionary coverage check ──
  'Assignment history': 'سجل التعيينات',
  'No records yet.': 'لا توجد سجلات بعد.',
  "You don't have permission to view this page.": 'ليست لديك صلاحية لعرض هذه الصفحة.',
  'Daily attendance records per employee.': 'سجلات الحضور اليومية لكل موظف.',
  'Employee identification and compliance documents, with expiry tracking.': 'وثائق هوية الموظفين والامتثال، مع تتبّع تواريخ الانتهاء.',
  'Employee leave requests and their approval status.': 'طلبات إجازات الموظفين وحالة الموافقة عليها.',
  'Employee roster with department, designation, and employment status.': 'قائمة الموظفين مع القسم والمسمى الوظيفي وحالة التوظيف.',
  'Employment contract terms, duration, and salary per employee.': 'شروط عقد العمل ومدته وراتب كل موظف.',
  'Job titles and levels, grouped by department.': 'المسميات الوظيفية ومستوياتها، مجمّعة حسب القسم.',
  'Organizational departments used across employee records.': 'الأقسام التنظيمية المستخدمة في سجلات الموظفين.',
  'Track repair and service jobs per truck, from diagnosis to completion cost.': 'تتبّع أعمال الإصلاح والصيانة لكل شاحنة، من التشخيص حتى تكلفة الإنجاز.',

  // ── Loading Orders page ──────────────────────────────────────
  'Generate loading order slips (Driver & Warehouse copies) for a route — the PDF opens in a new tab, ready to print or save.':
    'أنشئ قسائم أوامر التحميل (نسخة السائق ونسخة المستودع) لمسار معيّن — يُفتح ملف PDF في علامة تبويب جديدة جاهزًا للطباعة أو الحفظ.',
  'Generate loading order': 'إنشاء أمر تحميل',
  'Generating...': 'جارٍ الإنشاء...',
  'Loading order #': 'رقم أمر التحميل',
  Pickup: 'الاستلام',
  Delivery: 'التسليم',
  'Generated on': 'تاريخ الإنشاء',
  'No loading orders yet — generate your first batch above.': 'لا توجد أوامر تحميل بعد — أنشئ أول دفعة بالأعلى.',
  'Pickup, delivery, customer, and cargo type are all required.': 'موقع الاستلام والتسليم والعميل ونوع الحمولة كلها مطلوبة.',
  'Quantity must be a whole number between 1 and 200.': 'يجب أن تكون الكمية عددًا صحيحًا بين 1 و200.',
  'Unable to generate loading orders.': 'تعذّر إنشاء أوامر التحميل.',
  'Unable to open this batch as a PDF.': 'تعذّر فتح هذه الدفعة كملف PDF.',
  'Failed to load loading orders.': 'تعذّر تحميل أوامر التحميل.',
  'Delete loading order batch': 'حذف دفعة أوامر التحميل',
  'This cannot be undone.': 'لا يمكن التراجع عن هذا الإجراء.',
  'Delete failed.': 'فشل الحذف.',
  'Failed to load data.': 'تعذّر تحميل البيانات.',

  // ── Server error messages (backend ErrorCode descriptions) ───
  'Invalid username or password.': 'اسم المستخدم أو كلمة المرور غير صحيحة.',
  'Your account has been deactivated. Please contact an administrator.': 'تم تعطيل حسابك. يرجى التواصل مع المسؤول.',
  'Authentication required. Please log in.': 'يجب تسجيل الدخول.',
  'Your session has expired. Please log in again.': 'انتهت جلستك. يرجى تسجيل الدخول مرة أخرى.',
  'You do not have permission to perform this action.': 'ليست لديك صلاحية لتنفيذ هذا الإجراء.',
  'Too many failed sign-in attempts. Please wait a few minutes and try again.': 'محاولات تسجيل دخول فاشلة كثيرة. يرجى الانتظار بضع دقائق ثم المحاولة مرة أخرى.',
  'Something went wrong. Please try again.': 'حدث خطأ ما. يرجى المحاولة مرة أخرى.',
  'An unexpected error occurred. Please try again.': 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
  'The request contains invalid data.': 'يحتوي الطلب على بيانات غير صالحة.',
  'A record with the same unique value already exists.': 'يوجد سجل بنفس القيمة الفريدة بالفعل.',
  'One of the selected related records does not exist.': 'أحد السجلات المرتبطة المحددة غير موجود.',
  'This record is used by other records and cannot be deleted.': 'هذا السجل مستخدم في سجلات أخرى ولا يمكن حذفه.',
  'The requested record no longer exists.': 'السجل المطلوب لم يعد موجودًا.',
  'A user with this email already exists.': 'يوجد مستخدم بهذا البريد الإلكتروني بالفعل.',
  'A user with this username already exists.': 'يوجد مستخدم بهذا الاسم بالفعل.',
  'Password must be at least 8 characters long.': 'يجب ألا تقل كلمة المرور عن 8 أحرف.',
  'You cannot delete or deactivate your own account.': 'لا يمكنك حذف حسابك أو تعطيله.',
  'The ADMIN role is built in and cannot be renamed or deleted.': 'دور ADMIN مدمج ولا يمكن إعادة تسميته أو حذفه.',
  'This role is assigned to one or more users and cannot be deleted.': 'هذا الدور مسند إلى مستخدم أو أكثر ولا يمكن حذفه.',
  'This truck already has an assignment during the selected period.': 'هذه الشاحنة لديها تعيين بالفعل خلال الفترة المحددة.',
  'The end date must be on or after the start date.': 'يجب أن يكون تاريخ الانتهاء في تاريخ البدء أو بعده.',
  'A trip with this transaction number already exists.': 'توجد رحلة بنفس رقم المعاملة بالفعل.',
  'This action cannot be performed on the current invoice status.': 'لا يمكن تنفيذ هذا الإجراء على حالة الفاتورة الحالية.',
  'This invoice has already been submitted to ZATCA.': 'تم إرسال هذه الفاتورة إلى زاتكا بالفعل.',
  'This truck is used by one or more trips and cannot be deleted.': 'هذه الشاحنة مستخدمة في رحلة أو أكثر ولا يمكن حذفها.',
  'This driver is used by one or more trips and cannot be deleted.': 'هذا السائق مستخدم في رحلة أو أكثر ولا يمكن حذفه.',
  'This driver has truck assignments and cannot be deleted.': 'هذا السائق لديه تعيينات شاحنات ولا يمكن حذفه.',
  'This customer is used by one or more trips and cannot be deleted.': 'هذا العميل مستخدم في رحلة أو أكثر ولا يمكن حذفه.',
  'This supplier is used by one or more rate contracts and cannot be deleted.': 'هذا المورد مستخدم في عقد أسعار أو أكثر ولا يمكن حذفه.',
  'This location is used by one or more trips and cannot be deleted.': 'هذا الموقع مستخدم في رحلة أو أكثر ولا يمكن حذفه.',
  'This cargo type is used by one or more trips and cannot be deleted.': 'نوع الحمولة هذا مستخدم في رحلة أو أكثر ولا يمكن حذفه.',
  'This record is referenced by other records and cannot be deleted.': 'هذا السجل مرتبط بسجلات أخرى ولا يمكن حذفه.',
  'A record with this information already exists.': 'يوجد سجل بهذه المعلومات بالفعل.',
  'Attendance already recorded for this employee on this date.': 'تم تسجيل حضور هذا الموظف في هذا التاريخ بالفعل.',
  'Record not found.': 'السجل غير موجود.',

  // ── ZATCA settings page ──────────────────────────────────────
  'ZATCA e-Invoicing': 'الفوترة الإلكترونية (زاتكا)',
  'Phase-1 QR codes are live': 'رموز QR للمرحلة الأولى مفعّلة',
  'Every invoice gets a real ZATCA-compliant QR code (seller name, VAT number, timestamp, total, and VAT amount, TLV-encoded) when you use':
    'تحصل كل فاتورة على رمز QR حقيقي متوافق مع زاتكا (اسم البائع، الرقم الضريبي، التاريخ والوقت، الإجمالي، ومبلغ الضريبة، مُرمّز بصيغة TLV) عند استخدام',
  'on the Invoices page.': 'في صفحة الفواتير.',
  "Phase-2 integration — the cryptographic invoice stamp and live clearance/reporting calls to ZATCA's API — needs a government-issued CSR and CSID certificate for your CR number, which this environment has no way to request or test against. The database is ready for it (see the company settings record's onboarding fields), so wiring in real certificates later is a config change, not a rebuild.":
    'تكامل المرحلة الثانية — الختم التشفيري للفاتورة ونداءات التخليص/الإبلاغ المباشرة إلى واجهة برمجة تطبيقات زاتكا — يتطلب شهادة CSR وCSID صادرة من جهة حكومية لرقم سجلك التجاري، وهو ما لا تستطيع هذه البيئة طلبه أو اختباره. قاعدة البيانات جاهزة لذلك (انظر حقول الإعداد في سجل إعدادات الشركة)، لذا ربط الشهادات الحقيقية لاحقًا هو تغيير إعدادات، وليس إعادة بناء.',
};

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * Renders a number (or any string containing digits, e.g. "12 · 450 SAR")
 * using Arabic-Indic numerals when `language` is 'ar', so dashboard stats
 * and counts read in Arabic too, not just their surrounding labels. Any
 * non-digit characters (separators, currency codes, punctuation) pass
 * through unchanged.
 */
export function localizeDigits(value: string | number, language: 'en' | 'ar'): string {
  const text = String(value);
  if (language !== 'ar') return text;
  return text.replace(/[0-9]/g, (d) => ARABIC_INDIC_DIGITS[Number(d)]);
}

/**
 * Like `localizeDigits`, but also swaps known English words embedded in a
 * composite stat value (currently just the "SAR" currency code) for their
 * Arabic dictionary entry. Used for dashboard stat-card values such as
 * "12 · 450 SAR", which mix a translated word into an otherwise numeric
 * string that a plain dictionary lookup can't match as a whole.
 */
export function localizeStatValue(value: string | number, language: 'en' | 'ar'): string {
  let text = String(value);
  if (language === 'ar') {
    text = text.replace(/\bSAR\b/g, AR_STRINGS.SAR ?? 'SAR');
    text = text.replace(/[0-9]/g, (d) => ARABIC_INDIC_DIGITS[Number(d)]);
  }
  return text;
}

/**
 * Looks up `text` in the Arabic dictionary when `language` is 'ar';
 * returns the original English text unchanged for 'en' or for any string
 * not yet in the dictionary, so this is always safe to wrap around a
 * literal even before a translation has been added for it.
 */
export function translate(text: string, language: 'en' | 'ar'): string {
  if (language !== 'ar') return text;
  return AR_STRINGS[text] ?? text;
}
