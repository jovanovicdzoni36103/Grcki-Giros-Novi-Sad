/**
 * Grčki Giros — backend configuration: sheet names, column schemas, statuses.
 * Column order below is only used when a sheet is created; the code always reads
 * columns by header name, so the owner may reorder columns in Sheets.
 */

var SHEETS = {
  DASHBOARD: 'DASHBOARD',
  ORDERS: 'ORDERS',
  ORDER_ITEMS: 'ORDER_ITEMS',
  CUSTOMERS: 'CUSTOMERS',
  PRODUCTS: 'PRODUCTS',
  CATEGORIES: 'CATEGORIES',
  OPTION_GROUPS: 'OPTION_GROUPS',
  OPTIONS: 'OPTIONS',
  SETTINGS: 'SETTINGS',
  HOURS: 'HOURS',
  SPECIAL_HOURS: 'SPECIAL_HOURS',
  ZONES: 'ZONES',
  DAILY_STATS: 'DAILY_STATS',
  WEEKLY_STATS: 'WEEKLY_STATS',
  MONTHLY_STATS: 'MONTHLY_STATS',
  LIFETIME_STATS: 'LIFETIME_STATS',
  REPORT_CONFIG: 'REPORT_CONFIG',
  CONTACT: 'CONTACT',
  JOBS: 'JOBS',
  RECS_AUTO: 'RECS_AUTO',
  SYSTEM_LOG: 'SYSTEM_LOG',
  ERROR_LOG: 'ERROR_LOG'
};

/** Tab order in the spreadsheet (setup creates them in this order). */
var SHEET_ORDER = [
  'DASHBOARD', 'ORDERS', 'ORDER_ITEMS', 'CUSTOMERS', 'PRODUCTS', 'CATEGORIES', 'OPTION_GROUPS', 'OPTIONS',
  'SETTINGS', 'HOURS', 'SPECIAL_HOURS', 'ZONES', 'REPORT_CONFIG', 'DAILY_STATS', 'WEEKLY_STATS', 'MONTHLY_STATS',
  'LIFETIME_STATS', 'CONTACT', 'JOBS', 'RECS_AUTO', 'SYSTEM_LOG', 'ERROR_LOG'
];

var COLUMNS = {
  ORDERS: [
    'Timestamp', 'Business Date', 'Internal Order ID', 'Public Order Number', 'Order Type', 'Status',
    'Customer Name', 'Phone', 'Email', 'Address', 'Apartment/Floor', 'Zone', 'Delivery Note', 'Order Note',
    'Order Items', 'Items Count', 'Subtotal', 'Delivery Cost', 'Total', 'Cash Provided', 'Change Required',
    'Requested Time', 'Promised Time', 'Actual Time', 'Accepted At', 'Completed At',
    'Source', 'Channel', 'Request ID', 'Status Token', 'Created At', 'Updated At', 'Items JSON', 'Email Status', 'Location ID'
  ],
  ORDER_ITEMS: [
    'Order ID', 'Business Date', 'Public Number', 'Line', 'Product ID', 'Product', 'Category ID', 'Category',
    'Kind', 'Qty', 'Unit Price', 'Line Total', 'Options', 'Removed', 'Note', 'Order Type', 'Status', 'Created At'
  ],
  CUSTOMERS: [
    'Phone', 'Name', 'Email', 'First Order At', 'Last Order At', 'Orders', 'Total Spent', 'Average Order',
    'Favorite Product', 'Last Address', 'Delivery Orders', 'Pickup Orders', 'Cancelled Orders', 'Product Counts', 'Notes'
  ],
  PRODUCTS: [
    'id', 'category_id', 'name', 'description', 'price', 'compare_price', 'available', 'delivery', 'pickup', 'tags',
    'badge', 'groups', 'defaults', 'pairs', 'bundle_hint', 'includes', 'kind', 'image', 'art', 'sort', 'active', 'demo'
  ],
  CATEGORIES: ['id', 'name', 'description', 'sort', 'active'],
  OPTION_GROUPS: ['id', 'name', 'type', 'required', 'min', 'max', 'display', 'hint', 'sort'],
  OPTIONS: ['id', 'group_id', 'name', 'price', 'available', 'sort'],
  SETTINGS: ['key', 'value', 'note'],
  HOURS: ['dow', 'day', 'open', 'close', 'delivery_open', 'delivery_close', 'closed'],
  SPECIAL_HOURS: ['date', 'label', 'open', 'close', 'delivery_open', 'delivery_close', 'closed', 'active', 'note'],
  ZONES: ['id', 'name', 'areas', 'fee', 'min_order', 'active', 'sort', 'note'],
  REPORT_CONFIG: ['key', 'value', 'note'],
  DAILY_STATS: [
    'Date', 'Weekday', 'Orders', 'Revenue', 'Delivery Orders', 'Pickup Orders', 'Cancelled', 'Average Order',
    'Delivery Fees', 'Items Sold', 'Top Product', 'Busiest Hour', 'Updated At'
  ],
  WEEKLY_STATS: [
    'Week', 'From', 'To', 'Orders', 'Revenue', 'Average Order', 'Delivery Orders', 'Pickup Orders', 'Cancelled',
    'Cancellation %', 'Top Product', 'Top Package', 'Busiest Day', 'Busiest Hour', 'Revenue vs Prev %', 'Orders vs Prev %', 'Updated At'
  ],
  MONTHLY_STATS: [
    'Month', 'Orders', 'Revenue', 'Average Order', 'Delivery Orders', 'Pickup Orders', 'Cancelled', 'Cancellation %',
    'Top Product', 'Top Category', 'Top Package', 'Top Time', 'Busiest Day', 'Busiest Hour', 'Growth vs Prev %', 'Updated At'
  ],
  LIFETIME_STATS: ['Metric', 'Value', 'Updated At'],
  CONTACT: ['Timestamp', 'Name', 'Phone', 'Email', 'Topic', 'Message', 'Status', 'Request ID'],
  JOBS: ['Timestamp', 'Name', 'Phone', 'Email', 'Position', 'Experience', 'Shift', 'Message', 'CV', 'Status', 'Request ID'],
  RECS_AUTO: ['Product ID', 'Product', 'Often With (IDs)', 'Often With', 'Orders Seen', 'Updated At'],
  SYSTEM_LOG: ['Timestamp', 'Request ID', 'Severity', 'Function', 'Status', 'Message', 'Order ID', 'Duration ms', 'Retry', 'Details'],
  ERROR_LOG: ['Timestamp', 'Request ID', 'Severity', 'Function', 'Error', 'Stack', 'Order ID', 'Context']
};

/** Sheets whose values are typed by humans as text (times, dates, ids) — formatted as plain text on setup. */
var TEXT_COLUMNS = {
  ORDERS: ['Business Date', 'Phone', 'Requested Time', 'Promised Time', 'Actual Time', 'Internal Order ID', 'Request ID', 'Status Token', 'Created At', 'Updated At', 'Accepted At', 'Completed At'],
  ORDER_ITEMS: ['Order ID', 'Business Date', 'Created At'],
  CUSTOMERS: ['Phone', 'First Order At', 'Last Order At'],
  HOURS: ['open', 'close', 'delivery_open', 'delivery_close'],
  SPECIAL_HOURS: ['date', 'open', 'close', 'delivery_open', 'delivery_close'],
  SETTINGS: ['value'],
  REPORT_CONFIG: ['value'],
  CONTACT: ['Phone'],
  JOBS: ['Phone'],
  DAILY_STATS: ['Date'],
  WEEKLY_STATS: ['Week', 'From', 'To'],
  MONTHLY_STATS: ['Month']
};

var STATUS = {
  NEW: 'NEW',
  ACCEPTED: 'ACCEPTED',
  PREPARING: 'PREPARING',
  READY: 'READY',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED'
};
var STATUS_LIST = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED', 'FAILED'];
var STATUS_FINAL = ['COMPLETED', 'CANCELLED', 'FAILED'];
var STATUS_NOT_REVENUE = ['CANCELLED', 'FAILED'];

var ORDER_TYPE = { delivery: 'DELIVERY', pickup: 'PICKUP' };

var CACHE_TTL_SEC = 60;
var IDEMPOTENCY_TTL_SEC = 6 * 60 * 60;
var LOCK_WAIT_MS = 20000;
var MAX_BODY_BYTES = 60 * 1024;
var MAX_UPLOAD_BODY_BYTES = 6 * 1024 * 1024;
var LOG_KEEP_ROWS = 5000;

/** Fallbacks when a SETTINGS key is missing (the sheet always wins). */
var DEFAULT_SETTINGS = {
  business_name: 'Grčki Giros',
  location_id: 'GG-01',
  phone_display: '064 227 4334',
  phone_e164: '+381642274334',
  timezone: 'Europe/Belgrade',
  order_number_max: '100',
  test_mode: 'TRUE',
  delivery_fee_mode: 'fixed',
  delivery_fee_default: '0',
  zones_enabled: 'FALSE',
  rate_limit_phone_count: '3',
  rate_limit_phone_window_min: '10',
  rate_limit_global_per_min: '20',
  max_lines_per_order: '30',
  max_qty_per_line: '20',
  cash_max_over_total: '20000',
  revenue_includes_delivery: 'FALSE',
  customer_confirmation_enabled: 'TRUE',
  panel_poll_seconds: '10',
  site_url: 'https://grckigiros.rs'
};
