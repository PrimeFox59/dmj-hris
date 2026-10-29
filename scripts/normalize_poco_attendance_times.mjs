import { spawn } from 'node:child_process';

const code = `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/data/data/com.termux/files/home/prime-hris/data/hris.sqlite');

const rows = db.prepare("SELECT id, checkInTime, checkOutTime, data_json FROM attendances WHERE checkInTime LIKE '%.%' OR checkOutTime LIKE '%.%';").all();
console.log('Found ' + rows.length + ' attendance rows with dot delimiters to normalize.');

const updateStmt = db.prepare("UPDATE attendances SET checkInTime = ?, checkOutTime = ?, data_json = ? WHERE id = ?;");
for (const row of rows) {
  const normIn = row.checkInTime ? row.checkInTime.replace(/\\./g, ':') : row.checkInTime;
  const normOut = row.checkOutTime ? row.checkOutTime.replace(/\\./g, ':') : row.checkOutTime;
  let dataJson = row.data_json;
  try {
    const parsed = JSON.parse(dataJson);
    if (parsed.checkInTime) parsed.checkInTime = normIn;
    if (parsed.checkOutTime) parsed.checkOutTime = normOut;
    dataJson = JSON.stringify(parsed);
  } catch (e) {}
  updateStmt.run(normIn, normOut, dataJson, row.id);
  console.log('Normalized row ' + row.id + ': ' + row.checkInTime + ' -> ' + normIn);
}
console.log('Attendance normalization complete!');
`;

const b64 = Buffer.from(code).toString('base64');
const proc = spawn('ssh', ['poco', `node -e "eval(Buffer.from('${b64}','base64').toString())"`], {
  stdio: 'inherit'
});
