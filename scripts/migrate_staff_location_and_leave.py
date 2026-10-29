import openpyxl
import sqlite3
import json
import re
import difflib
import os
import datetime

excel_path = r'C:\Users\PRIMA\Downloads\TABEL CUTI STAFF PROYEK DMJ (1).xlsx'
db_path = 'data/hris.sqlite'
seed_path = 'data/seedData.json'

print(f'[MIGRATE] Loading Excel: {excel_path}')
wb = openpyxl.load_workbook(excel_path, data_only=True)
ws_nonlokal = wb['STAFF NON LOKAL - 2025']

records = []
current_emp = None

for r in range(5, ws_nonlokal.max_row + 1):
    no_val = ws_nonlokal.cell(r, 1).value
    name_val = ws_nonlokal.cell(r, 2).value
    days_val = ws_nonlokal.cell(r, 4).value
    
    dates = []
    for c in range(5, ws_nonlokal.max_column + 1):
        v = ws_nonlokal.cell(r, c).value
        if v:
            if hasattr(v, 'strftime'):
                dates.append(v.strftime('%Y-%m-%d'))
            else:
                dates.append(str(v).strip())

    if name_val and str(name_val).strip() and not str(name_val).strip().isdigit():
        current_emp = {
            'no': no_val,
            'name': str(name_val).strip(),
            'leave_periods': []
        }
        records.append(current_emp)
    
    if current_emp and (days_val or dates):
        current_emp['leave_periods'].append({
            'row': r,
            'days': int(days_val) if days_val and str(days_val).isdigit() else 9,
            'dates': dates
        })

print(f'[MIGRATE] Total non-lokal staff records in Excel: {len(records)}')

# Connect SQLite
print(f'[MIGRATE] Connecting SQLite: {db_path}')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute('SELECT id, nik, name, data_json FROM employees')
db_emps = cursor.fetchall()

def clean_text(s):
    s = s.lower()
    s = re.sub(r'\(.*?\)', '', s)
    s = re.sub(r'[^a-z0-9 ]', '', s)
    return s.strip()

aliases = {
    'maulysa': 'mulyadi',
    'hendra irawan': 'hendra tri kurniawan',
    'edo': 'muhammad syamsul maarif',
    'syamsudin': 'mukh. samsudin',
    'fery indrianto': 'feri indrianto eko setiabudi',
    'mulyadi surveyor': 'mulyadi',
    'mulyadi mep': 'mulyadi',
    'zion (di bekasi per april 26)': 'zion sin misael',
    'saputra manik (ahmad)': 'muhammad sahrial saputra manik',
    'muhammad fatahul ashar': 'muhamad fatahul ashar',
    'anggit dian asahari': 'anggit dian nasahari',
    'jujun adi setiawan': 'jujun andi setiawan',
    'amri saifuddin': 'amri saifudin',
    'robert ashari': 'robet ashari',
    'kristina anggraeni': 'kristhina anggraeni',
    'andri herdiayana': 'andri herdiyana',
    'adji baroto': 'adjie barotho',
    'sunarbani': 'sunarbany',
    'nur prasetyo': 'nur prasetio',
    'muhamad fatah': 'muhamad fatahul ashar',
    'alif restu': 'dimas alif iswanto'
}

non_lokal_matches = {}

for rec in records:
    ex_name = rec['name']
    c_ex = clean_text(ex_name)
    alias = aliases.get(c_ex)
    
    best_emp = None
    best_score = 0
    
    for emp_id, nik, db_name, dj in db_emps:
        c_db = clean_text(db_name)
        if alias and alias in c_db:
            best_emp = (emp_id, nik, db_name, dj)
            best_score = 1.0
            break
        
        ratio = difflib.SequenceMatcher(None, c_ex, c_db).ratio()
        ex_words = set(c_ex.split())
        db_words = set(c_db.split())
        if ex_words and db_words and (ex_words.issubset(db_words) or db_words.issubset(ex_words)):
            ratio = max(ratio, 0.90)
        
        if ratio > best_score:
            best_score = ratio
            best_emp = (emp_id, nik, db_name, dj)
    
    if best_score >= 0.75 and best_emp:
        non_lokal_matches[best_emp[0]] = {
            'excel_no': rec['no'],
            'excel_name': ex_name,
            'db_id': best_emp[0],
            'db_name': best_emp[2],
            'periods': rec['leave_periods']
        }

print(f'[MIGRATE] Matched {len(non_lokal_matches)} DB employees to Non-Lokal list.')

today = datetime.date.today()
updated_count_non_lokal = 0
updated_count_lokal = 0

update_stmt = 'UPDATE employees SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'

all_updated_seed_emps = []

for emp_id, nik, db_name, dj in db_emps:
    emp_data = {}
    try:
        emp_data = json.loads(dj)
    except Exception:
        emp_data = {'id': emp_id, 'nik': nik, 'name': db_name}

    if emp_id in non_lokal_matches:
        match_info = non_lokal_matches[emp_id]
        emp_data['workLocationType'] = 'NON_LOKAL'
        
        # Parse periods
        history = []
        all_dates = []
        default_days = 9
        for p in match_info['periods']:
            if p.get('days'):
                default_days = p['days']
            p_dates = p.get('dates', [])
            if p_dates:
                all_dates.extend(p_dates)
                history.append({
                    'startDate': p_dates[0],
                    'endDate': p_dates[-1],
                    'days': len(p_dates),
                    'status': 'SCHEDULED'
                })

        # Calculate last leave date and next eligible leave date
        last_leave = None
        next_leave = None
        sorted_dates = sorted(all_dates)
        past_dates = [d for d in sorted_dates if d <= today.strftime('%Y-%m-%d')]
        future_dates = [d for d in sorted_dates if d > today.strftime('%Y-%m-%d')]

        if past_dates:
            last_leave = past_dates[-1]
        elif sorted_dates:
            last_leave = sorted_dates[0]

        if future_dates:
            next_leave = future_dates[0]
        elif last_leave:
            # Add 3 months
            try:
                y, m, d = map(int, last_leave.split('-'))
                m += 3
                if m > 12:
                    y += 1
                    m -= 12
                next_leave = f'{y:04d}-{m:02d}-{min(d, 28):02d}'
            except Exception:
                next_leave = '2026-11-15'
        else:
            next_leave = '2026-11-15'

        emp_data['nonLokalLeaveConfig'] = {
            'rosterCycleMonths': 3,
            'leaveQuotaPerPeriod': default_days,
            'usedPeriodLeave': 0,
            'lastLeaveDate': last_leave or '2025-06-01',
            'nextEligibleLeaveDate': next_leave,
            'allowEarlyLeave': True,
            'notes': f'Staff Non-Lokal Proyek (Rotasi Cuti 3 Bulan Sekali, Jatah: {default_days} Hari)',
            'scheduledLeaveHistory': history
        }
        updated_count_non_lokal += 1
    else:
        emp_data['workLocationType'] = 'LOKAL'
        if 'nonLokalLeaveConfig' in emp_data:
            del emp_data['nonLokalLeaveConfig']
        updated_count_lokal += 1

    cursor.execute(update_stmt, (json.dumps(emp_data), emp_id))
    all_updated_seed_emps.append(emp_data)

conn.commit()
conn.close()

print(f'[SUCCESS] SQLite Updated: {updated_count_non_lokal} NON_LOKAL, {updated_count_lokal} LOKAL.')

# Update seedData.json if exists
if os.path.exists(seed_path):
    try:
        with open(seed_path, 'r', encoding='utf-8') as f:
            seed = json.load(f)
        seed['INITIAL_EMPLOYEES'] = all_updated_seed_emps
        with open(seed_path, 'w', encoding='utf-8') as f:
            json.dump(seed, f, indent=2, ensure_ascii=False)
        print(f'[SUCCESS] Synced {len(all_updated_seed_emps)} employees into {seed_path}.')
    except Exception as e:
        print(f'[WARNING] Failed syncing seedData.json: {e}')

print('[MIGRATION COMPLETED SUCCESSFULLY]')
