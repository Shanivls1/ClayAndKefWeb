import { register, init } from './router.js';
import { installErrorLogging } from './log.js';
import { installRemindBadge } from './navbadge.js';
import { requireStaff, watchSignOut } from './auth.js';
import * as home      from './pages/home.js';
import * as dashboard from './pages/dashboard.js';
import * as orders    from './pages/orders.js';
import * as stock     from './pages/stock.js';
import * as customers from './pages/customers.js';
import * as exportPage from './pages/export.js';
import * as logs      from './pages/logs.js';
import * as settingsPage from './pages/settings.js';

register('/home',      home);
register('/dashboard', dashboard);
register('/orders',    orders);
register('/stock',     stock);
register('/customers', customers);
register('/export',    exportPage);
register('/logs',      logs);
register('/settings',  settingsPage);

installErrorLogging();

// Nothing loads until a staff member is signed in (auth.js); the database refuses everyone else anyway.
requireStaff().then(() => {
  watchSignOut();
  init();
  installRemindBadge();
});
