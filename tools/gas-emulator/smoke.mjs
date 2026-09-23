// Quick manual check: node tools/gas-emulator/smoke.mjs
import { freshBackend, placeOrder, bootstrap } from '../../tests/gas/helpers.mjs';

const emu = freshBackend();
const boot = bootstrap(emu);
console.log('bootstrap:', boot.catalog.products.length, 'products,', boot.hours.length, 'hours rows, serverNow', new Date(boot.serverNow).toISOString());
const res = placeOrder(emu);
console.log('order:', JSON.stringify(res, null, 1).slice(0, 1500));
console.log('outbox:', emu.state.outbox.map((m) => `${m.to} | ${m.subject}`));
console.log('ORDERS row:', emu.rows('ORDERS')[0]);
console.log('SYSTEM_LOG:', emu.rows('SYSTEM_LOG').map((r) => `${r.Severity} ${r.Function} ${r.Status} ${r.Message}`));
console.log('ERROR_LOG:', emu.rows('ERROR_LOG'));
