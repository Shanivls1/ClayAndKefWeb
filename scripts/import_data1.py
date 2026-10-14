"""Turns the owner's spreadsheet (data1.xlsx) into SQL parts in supabase/import_data1/.

Usage (needs openpyxl — `pip install --target <dir> openpyxl`, pass that dir as <pylib>):
  python scripts/import_data1.py <pylib> data1.xlsx supabase/import_data1 data1_not_imported.csv --assume-old-collected-days 90

Spreadsheet columns: first name, Surname, Phone Number, Order ID (1–1000, repeating), Ready, Message Sent,
Objects (codes like "mgy2*2 + cup1" = 2× MGY2 and 1× CUP1), Box ("נאסף" = collected, else location/notes), Date.
- Same phone = same customer. Each full code (MGY1, MGY2…) becomes an object type (leading zeros dropped).
- Missing dates are estimated from the dated rows around them (rows are in time order).
- With --assume-old-collected-days N, orders older than N days with no status at all count as collected.
- Rows with no order number (gift cards, workshops) or no pieces go to the report instead.
The generated SQL and the report contain customer data — both are in .gitignore.
"""
import sys, re, csv, uuid, datetime, collections, json
sys.path.insert(0, sys.argv[1])
import openpyxl

XLSX, OUT_SQL, REPORT = sys.argv[2], sys.argv[3], sys.argv[4]
ASSUME_DAYS = int(sys.argv[sys.argv.index('--assume-old-collected-days') + 1]) if '--assume-old-collected-days' in sys.argv else None
TODAY = datetime.date(2026, 10, 14)
NS = uuid.UUID('6f1c2a7e-0b5d-4c4e-9f1a-2d8b7c3e5a10')  # stable ids → re-running gives the same ids

wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
raw = [r for r in list(wb.worksheets[0].iter_rows(values_only=True))[1:] if any(c not in (None, '') for c in r)]
g = lambda r, i: r[i] if i < len(r) else None
txt = lambda v: '' if v is None else (str(int(v)) if isinstance(v, float) and v.is_integer() else str(v)).strip()

# ── dates: real ones where present, otherwise interpolated by row position ──────────────────────
anchors, last = [], None
for i, r in enumerate(raw):
    d = g(r, 8)
    if isinstance(d, datetime.datetime):
        d = d.date()
        if (last is None or d >= last) and d <= TODAY:   # ignore dates that go backwards or into the future
            anchors.append((i, d)); last = d
(i0, d0), (i1, d1) = anchors[0], anchors[-1]
per_day = (i1 - i0) / max(1, (d1 - d0).days)              # visits per day, used before the first dated row
def est_date(i):
    if i <= i0: return d0 - datetime.timedelta(days=round((i0 - i) / per_day))
    if i >= i1: return d1
    for (a, da), (b, db) in zip(anchors, anchors[1:]):
        if a <= i <= b:
            return da + datetime.timedelta(days=round((i - a) / (b - a) * (db - da).days)) if b > a else da
dated_exact = {i for i, _ in anchors}

# ── status from the Box column ───────────────────────────────────────────────────────────────────
COLLECTED = re.compile(r'נ[אע]ס[ףפךו]|נאסבף|נאספו|\bused\b|השתמש', re.I)
DONATED   = re.compile(r'תרומה')
def box_info(box):
    b = txt(box)
    if not b: return None, ''
    if COLLECTED.search(b): return 'collected', b
    if DONATED.search(b):   return 'donated', b
    return 'note', b

# ── pieces ───────────────────────────────────────────────────────────────────────────────────────
def norm_code(letters, digits):
    return letters.upper() + (str(int(digits)) if digits else '')     # mg01 → MG1
P_SUFFIX = re.compile(r'^([a-z]+)\s*(\d+)?\s*(?:\(\d+\))?\s*(?:[*x]\s*(\d+))?$')   # srp3*2, nrh1(2), csd1x2
P_PREFIX = re.compile(r'^(\d+)\s*[*x]\s*([a-z]+)\s*(\d+)?$')                      # 2*bbl1, 8 x rct1
def parse_pieces(text):
    pieces, unknown = [], []
    for part in re.split(r'\s*[+,&/]\s*', text.strip().lower()):
        part = part.strip().rstrip('.')
        if not part: continue
        m = P_SUFFIX.match(part)
        if m:
            pieces += [norm_code(m.group(1), m.group(2))] * int(m.group(3) or 1); continue
        m = P_PREFIX.match(part)
        if m:
            pieces += [norm_code(m.group(2), m.group(3))] * int(m.group(1)); continue
        unknown.append(part)
    return pieces, unknown

NOT_POTTERY = re.compile(r'gift|גיפט|כרטיס מתנה|חוג|hug|סדנ|sadna|שח\b|ש״ח|nis\b|caisse', re.I)

# ── walk the rows ────────────────────────────────────────────────────────────────────────────────
customers, orders, objects, skipped = {}, [], [], []
type_count = collections.Counter()
stats = collections.Counter()
for i, r in enumerate(raw):
    first, last_n, phone_raw, oid, ready, sent, objs = (g(r, k) for k in range(7))
    box_kind, box_text = box_info(g(r, 7))
    extra = [txt(c) for c in r[8:] if c not in (None, '') and not isinstance(c, datetime.datetime)]
    oid_s = txt(oid)
    m = re.search(r'\d+', oid_s)
    number = int(m.group()) if m else None
    obj_text = txt(objs)

    if number is None or number > 1000:
        # Gift cards, workshops, classes and notes have no order number — not pottery orders
        skipped.append((i + 2, 'No order number (gift card / workshop / note)', ' | '.join(txt(c) for c in r if c not in (None, ''))))
        stats['skipped'] += 1; continue
    pieces, unknown = parse_pieces(obj_text) if obj_text else ([], [])
    if not pieces and (not obj_text or NOT_POTTERY.search(obj_text)):
        skipped.append((i + 2, 'No pieces listed', ' | '.join(txt(c) for c in r if c not in (None, ''))))
        stats['skipped'] += 1; continue

    # customer: same phone = same person; no phone → same full name
    digits = re.sub(r'\D', '', txt(phone_raw))
    if digits.startswith('972'): digits = '0' + digits[3:]
    name = ' '.join(x for x in (txt(first), txt(last_n)) if x and x != 'None') or 'Unknown'
    key = ('p', digits) if len(digits) >= 9 else ('n', name.lower())
    c = customers.setdefault(key, {'id': str(uuid.uuid5(NS, f'c{key}')), 'phone': txt(phone_raw) if len(digits) >= 9 else '',
                                   'name': name, 'first_seen': None, 'names': set()})
    c['names'].add(name)
    c['name'] = name if name != 'Unknown' else c['name']   # latest name wins
    date = est_date(i)
    c['first_seen'] = c['first_seen'] or date

    # status
    is_ready, is_sent = ready == 1.0, sent == 1.0
    age = (TODAY - date).days
    notes = []
    if not re.fullmatch(r'\d+', oid_s): notes.append(f'Original number: {oid_s}')
    if box_kind in ('note', 'donated') or (box_kind == 'collected' and box_text.strip() not in ('נאסף', 'נאסוף', 'נעסף', 'נאסך', 'נאספ', 'נאספו', 'נאסבף')):
        notes.append(box_text)
    notes += extra
    if unknown: notes.append('Also listed: ' + ', '.join(unknown))
    if box_kind == 'collected':
        status = 'picked_up'
    elif box_kind == 'donated':
        status = 'picked_up'; stats['donated'] += 1
    elif ASSUME_DAYS is not None and box_kind is None and age > ASSUME_DAYS:
        status = 'picked_up'; stats['assumed_collected'] += 1
        notes.append('Imported as collected (no status in the spreadsheet)')
    elif is_ready or is_sent:
        status = 'ready'
    else:
        status = 'received'
    stats[status] += 1

    received_at = datetime.datetime.combine(date, datetime.time(12, 0))
    notified = None
    if is_sent or (status == 'picked_up' and is_ready):
        notified = min(received_at + datetime.timedelta(days=7), datetime.datetime.combine(TODAY, datetime.time(9, 0)))

    order_id = str(uuid.uuid5(NS, f'o{i}'))
    orders.append({'id': order_id, 'customer_id': c['id'], 'number': number, 'received_at': received_at,
                   'notes': ' · '.join(n for n in notes if n) or None, 'exact_date': i in dated_exact, 'row': i + 2})
    if not pieces:
        pieces = ['OTHER']
    for code in pieces:
        type_count[code] += 1
        objects.append({'order_id': order_id, 'code': code, 'status': status,
                        'notified_at': notified if status != 'received' else None})

# ── SQL ─────────────────────────────────────────────────────────────────────────────────────────
q = lambda v: 'null' if v is None else ("'" + str(v).replace("'", "''") + "'")
ts = lambda d: q(d.isoformat() + '+03:00') if d else 'null'
type_ids = {code: str(uuid.uuid5(NS, f't{code}')) for code in type_count}
current = next(o['number'] for o in reversed(orders))

# ── SQL, split into parts small enough for the Supabase SQL Editor ───────────────────────────────
# 01: create private staging tables (schema import_tmp — not reachable through the API)
# 02…: load the spreadsheet into staging (live data untouched; re-running a part is harmless)
# last: one transaction that swaps the live data for the staged data, then drops staging
import os, shutil
if os.path.isdir(OUT_SQL): shutil.rmtree(OUT_SQL)
os.makedirs(OUT_SQL)
MAX_PART = 110_000  # bytes per staging file

cust_rows = sorted(customers.values(), key=lambda c: c['first_seen'])
ckey = {c['id']: n for n, c in enumerate(cust_rows, 1)}
okey = {o['id']: n for n, o in enumerate(orders, 1)}
ST = {'received': 'r', 'ready': 'y', 'picked_up': 'p'}

staged = []  # (table, columns, row-sql)
for c in cust_rows:
    also = 'Also written as: ' + ', '.join(sorted(c['names'] - {c['name']})) if len(c['names']) > 1 else None
    staged.append(('c', f"({ckey[c['id']]},{q(c['name'])},{q(c['phone'] or None)},{q(also)},'{c['first_seen'].isoformat()}')"))
for o in orders:
    staged.append(('o', f"({okey[o['id']]},{o['number']},{ckey[o['customer_id']]},'{o['received_at'].date().isoformat()}',{q(o['notes'])})"))
for n, x in enumerate(objects, 1):
    staged.append(('p', f"({n},{okey[x['order_id']]},{q(x['code'])},'{ST[x['status']]}',{'true' if x['notified_at'] else 'false'})"))

parts, cur, size = [], [], 0
for t, row in staged:
    if size + len(row.encode()) > MAX_PART and cur:
        parts.append(cur); cur, size = [], 0
    cur.append((t, row)); size += len(row.encode()) + 2
if cur: parts.append(cur)
total = len(parts) + 2
fname = lambda n, label: os.path.join(OUT_SQL, f'{n:02d}_{label}.sql')
header = lambda n: f"-- Spreadsheet import, part {n} of {total}. Run the parts in order in Supabase → SQL Editor.\n"

open(fname(1, 'setup'), 'w', encoding='utf-8').write(header(1) + f"""-- Creates private staging tables for the import. Your live data is not touched until part {total}.
--   {len(customers)} customers · {len(orders)} orders · {len(objects)} pieces · {len(type_count)} object types
--   Dates: {len(dated_exact)} from the spreadsheet, the rest estimated from the rows around them.

create schema if not exists import_tmp;
revoke all on schema import_tmp from public, anon, authenticated;

drop table if exists import_tmp.c, import_tmp.o, import_tmp.p;
create table import_tmp.c (k int primary key, name text, phone text, notes text, first_seen date);
create table import_tmp.o (k int primary key, num int, ck int, at date, notes text);
create table import_tmp.p (n int primary key, ok int, code text, st char, told boolean);
""")

COLS = {'c': 'import_tmp.c (k, name, phone, notes, first_seen)',
        'o': 'import_tmp.o (k, num, ck, at, notes)',
        'p': 'import_tmp.p (n, ok, code, st, told)'}
for n, part in enumerate(parts, 2):
    body = [header(n) + '-- Loads rows into staging. Safe to run again.\n']
    for t in 'cop':
        rows = [r for tt, r in part if tt == t]
        if rows:
            body.append(f"insert into {COLS[t]} values\n" + ',\n'.join(rows) + '\non conflict do nothing;\n')
    open(fname(n, 'data'), 'w', encoding='utf-8').write('\n'.join(body))

expected = (len(cust_rows), len(orders), len(objects))
open(fname(total, 'replace_live_data'), 'w', encoding='utf-8').write(header(total) + f"""-- WARNING: deletes ALL customers, orders, objects, object types and log entries, and replaces them with
-- the spreadsheet. One transaction: if anything fails (including a missing part), nothing changes.

begin;

-- Stop if a part wasn't run
do $$
begin
  if (select count(*) from import_tmp.c) <> {expected[0]}
     or (select count(*) from import_tmp.o) <> {expected[1]}
     or (select count(*) from import_tmp.p) <> {expected[2]} then
    raise exception 'Staging is incomplete (customers %/{expected[0]}, orders %/{expected[1]}, pieces %/{expected[2]}) — run all parts 2–{total - 1} first.',
      (select count(*) from import_tmp.c), (select count(*) from import_tmp.o), (select count(*) from import_tmp.p);
  end if;
end $$;

-- Columns the spreadsheet can leave empty
alter table public.customers    alter column phone           drop not null;
alter table public.object_types alter column low_stock_alert drop not null;
alter table public.object_types alter column category        drop not null;

-- Order numbers repeat across the spreadsheet's rounds (1–1000), so they can't be unique
do $$
declare r record;
begin
  for r in select c.conname from pg_constraint c
           join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
           where c.conrelid = 'public.orders'::regclass and c.contype = 'u' and a.attname = 'order_number'
  loop execute format('alter table public.orders drop constraint %I', r.conname); end loop;
  for r in select i.indexrelid::regclass as idx from pg_index i
           join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
           where i.indrelid = 'public.orders'::regclass and i.indisunique and not i.indisprimary and a.attname = 'order_number'
  loop execute format('drop index %s', r.idx); end loop;
end $$;

-- Load fast and keep the spreadsheet's own order numbers (triggers back on below)
alter table public.orders       disable trigger user;
alter table public.objects      disable trigger user;
alter table public.customers    disable trigger user;
alter table public.object_types disable trigger user;

delete from public.objects;
delete from public.orders;
delete from public.customers;
delete from public.object_types;

do $$
declare seq text := pg_get_serial_sequence('public.objects', 'object_number');
begin
  if seq is not null then execute format('alter sequence %s restart with 1', seq); end if;
end $$;

-- Object types: one per code. Names, prices and stock are for the owner to fill in on the Stock page.
insert into public.object_types (id, code, name, category, price, raw_stock, low_stock_alert)
select md5('t' || code)::uuid, code, case when code = 'OTHER' then 'Other (see order notes)' else code end, null, 0, 0, null
from (select distinct code from import_tmp.p) t;

insert into public.customers (id, name, phone, notes, created_at)
select md5('c' || k)::uuid, name, phone, notes, (first_seen + time '12:00') at time zone 'Asia/Jerusalem'
from import_tmp.c order by k;

-- Oldest first, so the internal piece numbering follows the calendar. Same-day orders get 10:00, 10:01, …
-- in spreadsheet order, so they sort correctly even when the numbering wraps from 999 to 1.
insert into public.orders (id, order_number, customer_id, received_at, created_at, notes)
select md5('o' || k)::uuid, num, md5('c' || ck)::uuid, ts, ts, notes
from (select *, ((at + time '10:00') + (row_number() over (partition by at order by k) - 1) * interval '1 minute')
                at time zone 'Asia/Jerusalem' ts
      from import_tmp.o) o
order by k;

-- Told customers: estimated as a week after the visit (never in the future)
insert into public.objects (order_id, object_type_id, status, notified_at)
select md5('o' || p.ok)::uuid, md5('t' || p.code)::uuid,
       case p.st when 'r' then 'received' when 'y' then 'ready' else 'picked_up' end,
       case when p.told then least((o.at + 7 + time '12:00') at time zone 'Asia/Jerusalem', now()) end
from import_tmp.p p join import_tmp.o o on o.k = p.ok
order by p.n;

-- New orders continue after the spreadsheet's latest number (#{current})
select setval('public.orders_order_number_seq', {current});

-- Returning-customer flags, triggers back on, fresh activity log, staging removed
update public.customers c set is_returning = (
  select count(*) > 1 from public.objects o join public.orders r on r.id = o.order_id where r.customer_id = c.id
);
alter table public.orders       enable trigger user;
alter table public.objects      enable trigger user;
alter table public.customers    enable trigger user;
alter table public.object_types enable trigger user;
delete from public.activity_log;
drop schema import_tmp cascade;

commit;
""")
print('parts:', total, [f"{os.path.basename(p)} {os.path.getsize(os.path.join(OUT_SQL, p)) // 1024}KB" for p in sorted(os.listdir(OUT_SQL))], file=sys.stderr)

with open(REPORT, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f)
    w.writerow(['Spreadsheet row', 'Why not imported', 'Row content'])
    w.writerows(skipped)

open_orders = [o for o in orders if any(x['order_id'] == o['id'] and x['status'] != 'picked_up' for x in objects)]
print(json.dumps({
    'customers': len(customers), 'orders': len(orders), 'pieces': len(objects), 'types': len(type_count),
    'skipped_rows': len(skipped), 'statuses': {k: stats[k] for k in ('received', 'ready', 'picked_up')},
    'donated': stats['donated'], 'assumed_collected': stats['assumed_collected'],
    'open_orders': len(open_orders),
    'open_orders_by_age': collections.Counter('≤30d' if (TODAY - o['received_at'].date()).days <= 30 else
                                              '31-90d' if (TODAY - o['received_at'].date()).days <= 90 else
                                              '91-365d' if (TODAY - o['received_at'].date()).days <= 365 else '>1y' for o in open_orders),
    'date_range': [orders[0]['received_at'].date().isoformat(), orders[-1]['received_at'].date().isoformat()],
    'current_number': current, 'top_types': type_count.most_common(8), 'other_pieces': type_count['OTHER'],
}, ensure_ascii=False, indent=1, default=str))
