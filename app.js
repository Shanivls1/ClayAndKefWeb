import { register, init } from './router.js';
import * as dashboard from './pages/dashboard.js';
import * as objects   from './pages/objects.js';
import * as stock     from './pages/stock.js';
import * as customers from './pages/customers.js';

register('/dashboard', dashboard);
register('/objects',   objects);
register('/stock',     stock);
register('/customers', customers);

init();
