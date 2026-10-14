import { register, init } from './router.js';
import { installErrorLogging } from './log.js';
import * as dashboard from './pages/dashboard.js';
import * as orders    from './pages/orders.js';
import * as stock     from './pages/stock.js';
import * as customers from './pages/customers.js';
import * as exportPage from './pages/export.js';
import * as logs      from './pages/logs.js';
import * as settingsPage from './pages/settings.js';

register('/dashboard', dashboard);
register('/orders',    orders);
register('/stock',     stock);
register('/customers', customers);
register('/export',    exportPage);
register('/logs',      logs);
register('/settings',  settingsPage);

installErrorLogging();
init();
