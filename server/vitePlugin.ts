import type { Plugin, ViteDevServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getAllData,
  saveAttendance,
  updateApproval,
  saveEmployee,
  updateUserProfile,
  deleteEmployee,
  saveProject,
  saveSalaryRules,
  resetDatabase,
  getDbInfo,
  addAuditLog,
  getAuditLogsPaginated
} from './db.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const dbPath = path.join(projectRoot, 'data', 'hris.sqlite');

export function sqliteApiPlugin(): Plugin {
  return {
    name: 'sqlite-api-plugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // Only handle /api/ routes
        if (!url.startsWith('/api/')) {
          return next();
        }

        const cleanUrl = url.split('?')[0];
        const method = req.method?.toUpperCase() || 'GET';

        // Helper to parse JSON body
        const readBody = (): Promise<any> => {
          return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                resolve(body ? JSON.parse(body) : {});
              } catch (err) {
                reject(err);
              }
            });
            req.on('error', reject);
          });
        };

        // Helper to send JSON response
        const sendJson = (statusCode: number, data: any) => {
          res.statusCode = statusCode;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };

        try {
          // 1. Health check & DB info
          if (cleanUrl === '/api/health' && method === 'GET') {
            return sendJson(200, {
              status: 'online',
              message: 'SQLite Database Connected (PRIME HRIS Enterprise)',
              ...getDbInfo()
            });
          }

          // 2. Bootstrap full data from SQLite
          if (cleanUrl === '/api/bootstrap' && method === 'GET') {
            const data = getAllData();
            return sendJson(200, data);
          }

          // 3. Save Attendance Record
          if (cleanUrl === '/api/attendance' && method === 'POST') {
            const body = await readBody();
            const result = saveAttendance(body);
            return sendJson(200, result);
          }

          // 4. Update Approval Item
          if (cleanUrl === '/api/approval' && (method === 'PUT' || method === 'POST')) {
            const body = await readBody();
            const result = updateApproval(body.id, body.status, body.reviewNote, body.reviewedBy);
            return sendJson(200, result);
          }

          // 5-profile. Update User Profile
          if ((cleanUrl === '/api/user/profile' || cleanUrl === '/api/profile') && method === 'POST') {
            const body = await readBody();
            const result = updateUserProfile(body);
            return sendJson(200, result);
          }

          // 5. Save Employee
          if (cleanUrl === '/api/employee' && method === 'POST') {
            const body = await readBody();
            const result = saveEmployee(body);
            return sendJson(200, result);
          }

          // 5a. Delete Employee
          const empDeleteMatch = cleanUrl.match(/^\/api\/employee\/([^\/]+)$/);
          if ((empDeleteMatch && method === 'DELETE') || (cleanUrl === '/api/employee/delete' && method === 'POST')) {
            let id = empDeleteMatch ? decodeURIComponent(empDeleteMatch[1]) : (await readBody())?.id;
            if (!id) return sendJson(400, { success: false, error: 'ID karyawan tidak valid' });
            if (id === 'EMP-001') {
              return sendJson(400, { success: false, error: 'Akun Master Superuser (EMP-001) dilindungi dan tidak dapat dihapus' });
            }
            const result = deleteEmployee(id);
            return sendJson(result.success ? 200 : 400, result);
          }

          // 5b. Save Project
          if (cleanUrl === '/api/project' && method === 'POST') {
            const body = await readBody();
            const result = saveProject(body);
            return sendJson(200, result);
          }

          // 7. Save Salary Rules & Geofence
          if (cleanUrl === '/api/salary-rules' && (method === 'PUT' || method === 'POST')) {
            const body = await readBody();
            const result = saveSalaryRules(body);
            return sendJson(200, result);
          }

          // 8. Audit Logs (Paginated & Filterable with 10-Item Load)
          if (cleanUrl === '/api/audit-logs' && method === 'GET') {
            const urlObj = new URL(req.url || '', 'http://localhost');
            const page = parseInt(urlObj.searchParams.get('page') || '1', 10);
            const limit = parseInt(urlObj.searchParams.get('limit') || '10', 10);
            const search = urlObj.searchParams.get('search') || '';
            const module = urlObj.searchParams.get('module') || '';
            const role = urlObj.searchParams.get('role') || '';
            const status = urlObj.searchParams.get('status') || '';

            const result = getAuditLogsPaginated({ page, limit, search, module, role, status });
            return sendJson(200, result);
          }

          if (cleanUrl === '/api/audit-logs' && method === 'POST') {
            const body = await readBody();
            addAuditLog({
              ...body,
              ipAddress: body.ipAddress || req.socket.remoteAddress || '127.0.0.1'
            });
            return sendJson(200, { success: true });
          }

          // 9. Reset SQLite Database to default seed
          if (cleanUrl === '/api/reset' && method === 'POST') {
            const data = resetDatabase();
            return sendJson(200, { success: true, message: 'Database reset to default seed', ...data });
          }

          // 9. Download SQLite Binary File
          if (cleanUrl === '/api/download-db' && method === 'GET') {
            if (!fs.existsSync(dbPath)) {
              return sendJson(404, { error: 'SQLite file not found' });
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/x-sqlite3');
            res.setHeader('Content-Disposition', 'attachment; filename="prime_hris.sqlite"');
            const fileStream = fs.createReadStream(dbPath);
            fileStream.pipe(res);
            return;
          }

          // Unknown API endpoint
          return sendJson(404, { error: `API endpoint ${cleanUrl} not found` });
        } catch (error: any) {
          console.error(`[SQLite API Error] ${method} ${cleanUrl}:`, error);
          return sendJson(500, {
            error: error.message || 'Internal Server Error',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          });
        }
      });
    }
  };
}
