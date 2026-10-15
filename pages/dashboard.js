import { supabase } from '../supabase.js';
import { fetchAllRows } from '../utils.js';
import { logEvent } from '../log.js';

// ─── Deps (React + Recharts, loaded once) ─────────────────────────────────────
let _deps = null;
async function loadDeps() {
  if (_deps) return _deps;
  const R = '18.3.1';
  const [rmv, rdv, rcv] = await Promise.all([
    import(`https://esm.sh/react@${R}`),
    import(`https://esm.sh/react-dom@${R}/client`),
    import(`https://esm.sh/recharts@2.13.3?deps=react@${R},react-dom@${R}`),
  ]);
  const React = rmv.default ?? rmv;
  const createRoot = rdv.createRoot ?? rdv.default?.createRoot;
  _deps = { React, h: React.createElement, createRoot, RC: rcv };
  return _deps;
}

// ─── Stock palette ────────────────────────────────────────────────────────────
const WARNING_COLOR = '#E83030';
const STOCK_COLORS = [
  '#9C1A4D', '#E05B2D', '#2D7CAD', '#5E9C2D',
  '#7B3DB8', '#C49020', '#2D9C8B', '#9C4A2D',
  '#AD2D6B', '#2D4DAD', '#8B6E2D', '#2D6BAD',
];

// ─── Skeleton rows ────────────────────────────────────────────────────────────
function skelRows() {
  return [80, 55, 95, 40, 70, 60, 85, 45].map(w => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:11px;">
      <span class="dash-skel" style="width:${w + 50}px;height:11px;border-radius:3px;flex-shrink:0;"></span>
      <span class="dash-skel" style="width:${w}%;height:18px;border-radius:3px;"></span>
    </div>`).join('');
}

// ─── Render ───────────────────────────────────────────────────────────────────
export function render() {
  return `
    <style>
      @keyframes dash-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
      .dash-skel {
        display:inline-block; background:#e8e1d8; border-radius:4px;
        animation:dash-pulse 1.4s ease-in-out infinite;
      }
      .rng-btn {
        padding:7px 16px; border-radius:8px; border:1px solid #e8e1d8;
        background:#fff; font-family:'Inter',sans-serif; font-size:13px;
        font-weight:500; color:#5a4a3a; cursor:pointer;
        transition:background .15s,border-color .15s,color .15s,box-shadow .15s;
      }
      .rng-btn:hover:not(.rng-on) { background:#f5f0eb; border-color:#d4c5b2; }
      .rng-btn.rng-on {
        background:#9C1A4D; border-color:#9C1A4D; color:#fff;
        box-shadow:0 2px 8px rgba(156,26,77,.38);
      }
      .dash-card {
        background:#fff; border-radius:14px; border:1px solid #e8e1d8;
        box-shadow:0 2px 6px rgba(45,31,20,.08),0 8px 24px rgba(45,31,20,.05);
        padding:24px 24px 16px; display:flex; flex-direction:column;
      }
      .dash-card-title {
        font-family:'Inter',sans-serif; font-size:17px; font-weight:700;
        color:#1a120b; margin-bottom:3px; letter-spacing:-.01em;
      }
      .dash-card-sub {
        font-family:'Inter',sans-serif; font-size:12px;
        color:#8a7560; margin-bottom:18px;
      }
      .chart-slot { flex:1; min-height:260px; }
      .chart-empty {
        display:flex; align-items:center; justify-content:center;
        min-height:260px; font-family:'Inter',sans-serif;
        font-size:13px; color:#8a7560; text-align:center; padding:24px;
      }
    </style>

    <svg style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:.04;"
      xmlns="http://www.w3.org/2000/svg">
      <filter id="ck-noise-dash">
        <feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="4" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#ck-noise-dash)"/>
    </svg>
    <div style="position:fixed;top:0;right:0;width:600px;height:400px;
      background:radial-gradient(ellipse farthest-side at top right,rgba(156,26,77,.08),transparent);
      pointer-events:none;z-index:0;"></div>

    <div style="padding:40px;position:relative;z-index:1;">

      <div style="display:flex;align-items:flex-end;justify-content:space-between;
        margin-bottom:32px;flex-wrap:wrap;gap:16px;">
        <div>
          <h1 style="font-family:'Caveat',cursive;font-size:42px;font-weight:700;
            letter-spacing:-.01em;color:#1a120b;margin-bottom:4px;">Analytics</h1>
          <p style="font-family:'Inter',sans-serif;color:#8a7560;font-size:15px;line-height:1.7;">
            Shop performance at a glance.</p>
        </div>
        <div id="range-bar" style="display:flex;gap:8px;">
          <button class="rng-btn" data-days="30">30 days</button>
          <button class="rng-btn rng-on" data-days="90">90 days</button>
          <button class="rng-btn" data-days="365">1 year</button>
          <button class="rng-btn" data-days="0">All time</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(460px,1fr));gap:20px;">

        <div class="dash-card" style="grid-column:1/-1;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div>
              <div class="dash-card-title">Stock Over Time</div>
              <div class="dash-card-sub">Raw unpainted stock per object type · estimated from current stock &amp; objects received</div>
            </div>
          </div>
          <div id="chart-stock" class="chart-slot" style="min-height:300px;">${skelRows()}</div>
        </div>

        <div class="dash-card">
          <div class="dash-card-title">Top Object Types</div>
          <div class="dash-card-sub">Objects painted, by type</div>
          <div id="chart-pop" class="chart-slot">${skelRows()}</div>
        </div>

        <div class="dash-card">
          <div class="dash-card-title">Top Customers by Orders</div>
          <div class="dash-card-sub">Number of visits (orders) per customer</div>
          <div id="chart-cust" class="chart-slot">${skelRows()}</div>
        </div>

        <div class="dash-card">
          <div class="dash-card-title">Customer Retention</div>
          <div class="dash-card-sub">New vs. returning customers per month</div>
          <div id="chart-ret" class="chart-slot">${skelRows()}</div>
        </div>

      </div>
    </div>
  `;
}

// ─── Mount ────────────────────────────────────────────────────────────────────
// Data is fetched once; switching the range only recomputes and redraws.
export async function mount(el, signal) {
  const roots = new Map(); // chart slot id → React root, reused across redraws
  signal.addEventListener('abort', () => roots.forEach(r => r.unmount()));

  const [deps, raw] = await Promise.all([loadDeps(), fetchData()]);
  if (signal.aborted) return;
  if (raw.objErr || raw.retErr) logEvent('error', `Dashboard data didn't load: ${raw.objErr ?? raw.retErr}`);

  let activeDays = 90;
  el.querySelector('#range-bar').addEventListener('click', e => {
    const btn = e.target.closest('[data-days]');
    if (!btn) return;
    el.querySelectorAll('.rng-btn').forEach(b => b.classList.remove('rng-on'));
    btn.classList.add('rng-on');
    activeDays = Number(btn.dataset.days);
    draw(el, deps, computeData(raw, activeDays), activeDays, roots);
  });

  draw(el, deps, computeData(raw, activeDays), activeDays, roots);
}

// ─── Stock timeline reconstruction ───────────────────────────────────────────
// Reconstructs stock at end of each day from current raw_stock + objects received after that day.
// Does not account for manual stock adjustments (no history table exists).
function buildStockTimeline(types, allObjects, days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let numDays;
  if (days === 0) {
    let earliest = today;
    for (const o of allObjects) {
      const d = new Date(o.orders?.received_at);
      if (!isNaN(d.getTime()) && d < earliest) earliest = d;
    }
    earliest.setHours(0, 0, 0, 0);
    numDays = Math.min(365, Math.ceil((today - earliest) / 86_400_000) + 1);
  } else {
    numDays = days;
  }

  // Pre-group received_at UTC timestamps by type_id
  const byType = {};
  for (const o of allObjects) {
    const tid = o.object_type_id;
    if (!byType[tid]) byType[tid] = [];
    byType[tid].push(new Date(o.orders?.received_at).getTime());
  }

  const pad = n => String(n).padStart(2, '0');
  const timeline = [];

  for (let i = numDays; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    // Use local date string to avoid UTC drift across timezones
    const dateStr = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    // End of this local day = start of next local day (UTC timestamp)
    const endOfDayTs = day.getTime() + 86_400_000;

    const point = { date: dateStr };
    for (const t of types) {
      const arr = byType[t.id] || [];
      // Objects received after this day have NOT yet been deducted from raw_stock at this point
      const afterCount = arr.filter(ts => ts >= endOfDayTs).length;
      point[t.id] = t.raw_stock + afterCount;
    }
    timeline.push(point);
  }

  return { timeline, numDays };
}

// ─── Draw all charts ──────────────────────────────────────────────────────────
function draw(el, deps, data, days, roots) {
  const { React, h, createRoot, RC } = deps;

  const tick = { fontFamily: "'Inter',sans-serif", fontSize: 11, fill: '#8a7560' };
  const labelTick = { fontFamily: "'Inter',sans-serif", fontSize: 11, fill: '#5a4a3a' };
  const tipStyle = {
    contentStyle: {
      fontFamily: "'Inter',sans-serif", fontSize: 12,
      border: '1px solid #e8e1d8', borderRadius: 8,
      boxShadow: '0 4px 12px rgba(45,31,20,.1)',
    },
    cursor: { fill: 'rgba(156,26,77,.06)' },
  };

  function mountChart(id, node) {
    let root = roots.get(id);
    if (!root) {
      const slot = el.querySelector('#' + id);
      if (!slot) return;
      slot.innerHTML = ''; // drop the skeleton
      root = createRoot(slot);
      roots.set(id, root);
    }
    root.render(node);
  }

  function empty(msg) {
    return h('div', { className: 'chart-empty' }, msg ?? 'No data for this period.');
  }

  // ── 1. Stock over time — line chart ───────────────────────────────────────
  {
    const { types, allObjects, err } = data.stock;

    if (err) {
      mountChart('chart-stock', empty('Could not load stock data.'));
    } else if (!types.length) {
      mountChart('chart-stock', empty('No object types found.'));
    } else {
      const { timeline, numDays } = buildStockTimeline(types, allObjects, days);
      const colorMap = Object.fromEntries(
        types.map((t, i) => [t.id, STOCK_COLORS[i % STOCK_COLORS.length]])
      );
      const tickInterval = Math.max(0, Math.floor(numDays / 8));

      // Prepare split timeline: each type gets _r (regular) and _w (warning/below threshold)
      // keys for line rendering, plus the raw value under t.id for tooltip lookup.
      const splitTimeline = timeline.map((point, i) => {
        const p = { date: point.date };
        const prev = i > 0 ? timeline[i - 1] : null;
        for (const t of types) {
          const val = point[t.id];
          const prevVal = prev ? prev[t.id] : null;
          const thr = t.low_stock_alert;
          p[t.id] = val; // raw value for tooltip
          if (!thr || thr <= 0 || val == null) {
            p[`${t.id}_r`] = val;
            p[`${t.id}_w`] = null;
          } else if (val >= thr) {
            p[`${t.id}_r`] = val;
            // Continuity: connect warning segment to threshold at rising transition
            p[`${t.id}_w`] = (prevVal != null && prevVal < thr) ? thr : null;
          } else {
            // Continuity: connect regular segment to threshold at falling transition
            p[`${t.id}_r`] = (prevVal != null && prevVal >= thr) ? thr : null;
            p[`${t.id}_w`] = val;
          }
        }
        return p;
      });

      function StockChart() {
        // With many types, start with the 8 most used; the rest are in the picker
        const [selected, setSelected] = React.useState(() => {
          if (types.length <= 12) return new Set(types.map(t => t.id));
          const used = {};
          for (const o of allObjects) used[o.object_type_id] = (used[o.object_type_id] ?? 0) + 1;
          return new Set([...types].sort((a, b) => (used[b.id] ?? 0) - (used[a.id] ?? 0)).slice(0, 8).map(t => t.id));
        });
        const [open, setOpen] = React.useState(false);
        const dropRef = React.useRef(null);

        React.useEffect(() => {
          if (!open) return;
          const handler = e => {
            if (dropRef.current && !dropRef.current.contains(e.target)) {
              setOpen(false);
            }
          };
          document.addEventListener('mousedown', handler);
          return () => document.removeEventListener('mousedown', handler);
        }, [open]);

        const toggle = id => setSelected(prev => {
          const next = new Set(prev);
          next.has(id) ? next.delete(id) : next.add(id);
          return next;
        });

        const selectedTypes = types.filter(t => selected.has(t.id));

        const btnBase = {
          fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600,
          border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
        };

        // Custom tooltip: show actual stock value + warning when below threshold
        function CustomTooltip({ active, label }) {
          if (!active || !label) return null;
          const point = splitTimeline.find(p => p.date === label);
          if (!point) return null;
          const date = new Date(label + 'T00:00:00');
          const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          const entries = selectedTypes
            .map(t => {
              const val = point[t.id];
              const thr = t.low_stock_alert;
              const isLow = thr > 0 && val != null && val < thr;
              return { name: t.name, value: val, isLow, color: colorMap[t.id] };
            })
            .filter(e => e.value != null);
          if (!entries.length) return null;
          return h('div', {
            style: {
              background: '#fff', border: '1px solid #e8e1d8', borderRadius: 10,
              padding: '10px 14px', boxShadow: '0 4px 14px rgba(45,31,20,.12)',
              fontFamily: "'Inter',sans-serif", fontSize: 12, minWidth: 160,
            },
          },
            h('p', { style: { color: '#8a7560', marginBottom: 8, fontWeight: 500, fontSize: 11 } }, dateStr),
            ...entries.map(e =>
              h('div', {
                key: e.name,
                style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
              },
                h('span', {
                  style: {
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: e.isLow ? WARNING_COLOR : e.color,
                  },
                }),
                h('span', { style: { color: '#5a4a3a', flex: 1 } }, e.name),
                h('span', {
                  style: {
                    fontWeight: 600, paddingLeft: 12,
                    color: e.isLow ? WARNING_COLOR : '#1a120b',
                  },
                }, e.value),
                e.isLow && h('span', {
                  style: { color: WARNING_COLOR, fontSize: 10, marginLeft: 2 },
                }, '▼')
              )
            )
          );
        }

        // Two Line components per type when threshold exists: regular + warning (red)
        const lines = selectedTypes.flatMap(t => {
          const hasThr = t.low_stock_alert > 0;
          const lineBase = {
            type: 'monotone', strokeWidth: 2, dot: false,
            connectNulls: false, legendType: 'none',
          };
          if (!hasThr) {
            return [h(RC.Line, {
              key: t.id, ...lineBase,
              dataKey: t.id, name: t.name,
              stroke: colorMap[t.id],
              activeDot: { r: 4, strokeWidth: 0, fill: colorMap[t.id] },
              legendType: 'line',
            })];
          }
          return [
            h(RC.Line, {
              key: `${t.id}_r`, ...lineBase,
              dataKey: `${t.id}_r`, name: t.name,
              stroke: colorMap[t.id],
              activeDot: { r: 4, strokeWidth: 0, fill: colorMap[t.id] },
              legendType: 'line',
            }),
            h(RC.Line, {
              key: `${t.id}_w`, ...lineBase,
              dataKey: `${t.id}_w`, name: t.name,
              stroke: WARNING_COLOR,
              strokeWidth: 2.5,
              activeDot: { r: 4, strokeWidth: 0, fill: WARNING_COLOR },
              legendType: 'none',
            }),
          ];
        });

        return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },

          // Dropdown
          h('div', { ref: dropRef, style: { position: 'relative', alignSelf: 'flex-start', zIndex: 20 } },
            h('button', {
              onClick: () => setOpen(o => !o),
              style: {
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 10px 6px 12px', borderRadius: 8,
                border: '1px solid #e8e1d8', background: '#faf7f4',
                fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 500,
                color: '#5a4a3a', cursor: 'pointer', lineHeight: 1,
              },
            },
              ...selectedTypes.slice(0, 5).map(t =>
                h('span', {
                  key: t.id,
                  style: {
                    width: 8, height: 8, borderRadius: '50%',
                    background: colorMap[t.id], display: 'inline-block', flexShrink: 0,
                  },
                })
              ),
              selectedTypes.length > 5 && h('span', {
                style: { fontSize: 10, color: '#8a7560' },
              }, `+${selectedTypes.length - 5}`),
              h('span', null,
                selected.size === types.length ? 'All types' :
                selected.size === 0 ? 'No types selected' :
                `${selected.size} type${selected.size !== 1 ? 's' : ''} selected`
              ),
              h('span', { style: { fontSize: 9, color: '#8a7560', marginLeft: 2 } }, open ? '▲' : '▼')
            ),

            open && h('div', {
              style: {
                position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                background: '#fff', border: '1px solid #e8e1d8', borderRadius: 12,
                boxShadow: '0 8px 28px rgba(45,31,20,.15)', padding: '8px 0',
                minWidth: 230, maxHeight: 300, overflowY: 'auto',
              },
            },
              h('div', {
                style: { display: 'flex', gap: 6, padding: '4px 12px 10px', borderBottom: '1px solid #f0ebe4' },
              },
                h('button', {
                  onClick: () => setSelected(new Set(types.map(t => t.id))),
                  style: { ...btnBase, color: '#9C1A4D', background: 'rgba(156,26,77,.07)' },
                }, 'All'),
                h('button', {
                  onClick: () => setSelected(new Set()),
                  style: { ...btnBase, color: '#5a4a3a', background: '#f5f0eb' },
                }, 'None')
              ),
              ...types.map(t =>
                h('label', {
                  key: t.id,
                  style: {
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 14px', cursor: 'pointer',
                    fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#1a120b',
                  },
                },
                  h('input', {
                    type: 'checkbox',
                    checked: selected.has(t.id),
                    onChange: () => toggle(t.id),
                    style: { accentColor: colorMap[t.id], width: 14, height: 14, cursor: 'pointer', flexShrink: 0 },
                  }),
                  h('span', {
                    style: {
                      width: 12, height: 12, borderRadius: '50%',
                      background: colorMap[t.id], display: 'inline-block', flexShrink: 0,
                    },
                  }),
                  t.name,
                  t.low_stock_alert > 0 && h('span', {
                    style: {
                      marginLeft: 'auto', fontSize: 11, color: '#8a7560',
                      fontFamily: "'Inter',sans-serif",
                    },
                  }, `alert: ${t.low_stock_alert}`)
                )
              )
            )
          ),

          // Chart or empty state
          selectedTypes.length === 0
            ? h('div', {
                style: {
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  minHeight: 280, fontFamily: "'Inter',sans-serif",
                  fontSize: 13, color: '#8a7560',
                },
              }, 'Select at least one type to view the chart.')
            : h(RC.ResponsiveContainer, { width: '100%', height: 300 },
                h(RC.LineChart, {
                  data: splitTimeline,
                  margin: { top: 4, right: 24, left: -10, bottom: 4 },
                },
                  h(RC.CartesianGrid, { strokeDasharray: '2 4', stroke: '#f0ebe4', vertical: false }),
                  h(RC.XAxis, {
                    dataKey: 'date', tick, axisLine: false, tickLine: false,
                    interval: tickInterval,
                    tickFormatter: v => {
                      const d = new Date(v + 'T00:00:00');
                      return `${d.getDate()}/${d.getMonth() + 1}`;
                    },
                  }),
                  h(RC.YAxis, { tick, axisLine: false, tickLine: false, allowDecimals: false }),
                  h(RC.Tooltip, { content: CustomTooltip }),
                  h(RC.Legend, {
                    wrapperStyle: { fontFamily: "'Inter',sans-serif", fontSize: 12, paddingTop: 10 },
                    iconSize: 10,
                  }),
                  ...lines
                )
              )
        );
      }

      mountChart('chart-stock', h(StockChart, {}));
    }
  }

  // ── 2. Top Object Types — horizontal bar ──────────────────────────────────
  {
    const { data: d, err } = data.pop;
    mountChart('chart-pop',
      err   ? empty('Could not load data.') :
      !d.length ? empty() :
      h(RC.ResponsiveContainer, { width: '100%', height: 260 },
        h(RC.BarChart, { data: d, layout: 'vertical', margin: { top: 4, right: 20, left: 0, bottom: 4 } },
          h(RC.CartesianGrid, { strokeDasharray: '2 4', stroke: '#f0ebe4', horizontal: false }),
          h(RC.XAxis, { type: 'number', tick, axisLine: false, tickLine: false }),
          h(RC.YAxis, {
            type: 'category', dataKey: 'name', width: 130,
            tick: { ...labelTick, textAnchor: 'end' }, axisLine: false, tickLine: false,
          }),
          h(RC.Tooltip, tipStyle),
          h(RC.Bar, { dataKey: 'count', name: 'Objects', fill: '#9C1A4D', radius: [0, 4, 4, 0], maxBarSize: 22 })
        )
      )
    );
  }

  // ── 3. Orders per customer — horizontal bar ───────────────────────────────
  {
    const { data: d, err } = data.cust;
    mountChart('chart-cust',
      err   ? empty('Could not load data.') :
      !d.length ? empty() :
      h(RC.ResponsiveContainer, { width: '100%', height: 260 },
        h(RC.BarChart, { data: d, layout: 'vertical', margin: { top: 4, right: 20, left: 0, bottom: 4 } },
          h(RC.CartesianGrid, { strokeDasharray: '2 4', stroke: '#f0ebe4', horizontal: false }),
          h(RC.XAxis, { type: 'number', tick, axisLine: false, tickLine: false, allowDecimals: false }),
          h(RC.YAxis, {
            type: 'category', dataKey: 'customer_name', width: 130,
            tick: { ...labelTick, textAnchor: 'end' }, axisLine: false, tickLine: false,
          }),
          h(RC.Tooltip, { ...tipStyle, formatter: v => [`${v} order${v === 1 ? '' : 's'}`, 'Orders'] }),
          h(RC.Bar, { dataKey: 'orders', name: 'Orders', fill: '#C44272', radius: [0, 4, 4, 0], maxBarSize: 22 })
        )
      )
    );
  }

  // ── 4. Customer retention — stacked bar ───────────────────────────────────
  {
    const { data: d, err } = data.ret;
    mountChart('chart-ret',
      err   ? empty('Could not load data.') :
      !d.length ? empty() :
      h(RC.ResponsiveContainer, { width: '100%', height: 260 },
        h(RC.BarChart, { data: d, margin: { top: 4, right: 20, left: -10, bottom: 4 } },
          h(RC.CartesianGrid, { strokeDasharray: '2 4', stroke: '#f0ebe4', vertical: false }),
          h(RC.XAxis, {
            dataKey: 'month', tick, axisLine: false, tickLine: false,
            tickFormatter: v => String(v ?? '').substring(0, 7),
          }),
          h(RC.YAxis, { tick, axisLine: false, tickLine: false, allowDecimals: false }),
          h(RC.Tooltip, tipStyle),
          h(RC.Legend, {
            wrapperStyle: { fontFamily: "'Inter',sans-serif", fontSize: 12, paddingTop: 8 },
            iconSize: 10,
          }),
          h(RC.Bar, { dataKey: 'new_customers', name: 'New', stackId: 's', fill: '#9C1A4D', maxBarSize: 32 }),
          h(RC.Bar, {
            dataKey: 'returning_customers', name: 'Returning', stackId: 's',
            fill: '#4A0A26', radius: [3, 3, 0, 0], maxBarSize: 32,
          })
        )
      )
    );
  }
}

// ─── Data ─────────────────────────────────────────────────────────────────────
async function fetchData() {
  const [retRes, typesRes, objectsRes] = await Promise.all([
    supabase.from('customer_retention').select('*').order('month'),
    supabase.from('object_types').select('id, name, price, raw_stock, low_stock_alert').order('name'),
    fetchAllRows(() => supabase
      .from('objects')
      .select('id, order_id, object_type_id, orders(received_at, customer_id, customers(name))')
      .order('id')),
  ]);
  return {
    retention: retRes.data ?? [],
    retErr:    retRes.error?.message ?? null,
    types:     typesRes.data ?? [],
    objects:   objectsRes.data ?? [],
    objErr:    typesRes.error?.message ?? objectsRes.error?.message ?? null,
  };
}

// Shapes the raw data for the selected range (days = 0 means all time).
function computeData(raw, days) {
  const start = days ? Date.now() - days * 86_400_000 : null;
  const inRange = start == null
    ? raw.objects
    : raw.objects.filter(o => new Date(o.orders?.received_at).getTime() >= start);
  const typeById = new Map(raw.types.map(t => [t.id, t]));

  // Most popular object types
  const popCounts = new Map();
  for (const o of inRange) popCounts.set(o.object_type_id, (popCounts.get(o.object_type_id) ?? 0) + 1);
  const pop = [...popCounts]
    .map(([id, count]) => ({ name: typeById.get(id)?.name ?? 'Unknown', count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Orders (visits) per customer — each order counted once, however many pieces it has
  const ordersByCustomer = new Map();
  for (const o of inRange) {
    const cid = o.orders?.customer_id;
    if (!cid) continue;
    const entry = ordersByCustomer.get(cid) ?? { customer_name: o.orders.customers?.name ?? '—', ids: new Set() };
    entry.ids.add(o.order_id);
    ordersByCustomer.set(cid, entry);
  }
  const cust = [...ordersByCustomer.values()]
    .map(e => ({ customer_name: e.customer_name, orders: e.ids.size }))
    .sort((a, b) => b.orders - a.orders || a.customer_name.localeCompare(b.customer_name))
    .slice(0, 10);

  // Retention rows are monthly — keep months that overlap the range
  let ret = raw.retention;
  if (start != null) {
    const d = new Date(start);
    const startMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    ret = ret.filter(r => String(r.month ?? '').slice(0, 7) >= startMonth);
  }

  return {
    pop:   { data: pop, err: raw.objErr },
    cust:  { data: cust, err: raw.objErr },
    ret:   { data: ret, err: raw.retErr },
    stock: { types: raw.types, allObjects: raw.objects, err: raw.objErr },
  };
}
