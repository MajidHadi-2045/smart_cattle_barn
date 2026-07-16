const fs = require('fs');

const collectionPath = './postman-collection.json';
const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));

// The mapping of rules based on the codebase's @Roles decorators
// Paths are based on Swagger paths (without /api)
const rbacRules = {
  // Dashboard
  'POST /dashboard/checklist-config': ['STAFF'],

  // Feed
  'POST /feed/silo': ['STAFF'],
  'PATCH /feed/silo/:id': ['STAFF'],
  'DELETE /feed/silo/:id': ['STAFF'],
  'POST /feed/silo/:id/stock': ['STAFF'],
  'POST /feed/formula': ['STAFF'],
  'PATCH /feed/formula/:id': ['STAFF'],
  'DELETE /feed/formula/:id': ['STAFF'],
  'POST /feed/formula/:id/distribute': ['STAFF'],

  // Health
  'POST /health': ['VETERINER'],
  'POST /health/bulk': ['VETERINER'],
  'PATCH /health/:id': ['VETERINER'],
  'DELETE /health/:id': ['VETERINER'],

  // Livestock
  'POST /livestock': ['STAFF'],
  'PATCH /livestock/:id': ['STAFF'],
  'DELETE /livestock/:cattleId': ['STAFF'],
  'POST /livestock/waste/settings': ['STAFF'],
  'POST /livestock/waste': ['STAFF'],
  'POST /livestock/waste/zone': ['STAFF'],
  'POST /livestock/waste/auto-all': ['STAFF'],
  'POST /livestock/weight': ['STAFF'],
  'POST /livestock/feed': ['STAFF'],
  'PATCH /livestock/feed/:id': ['STAFF'],
  'DELETE /livestock/feed/:id': ['STAFF'],
  'PATCH /livestock/weight/:id': ['STAFF'],
  'DELETE /livestock/weight/:id': ['STAFF'],
  'PATCH /livestock/waste/:id': ['STAFF'],
  'DELETE /livestock/waste/:id': ['STAFF'],
  'PATCH /livestock/waste/zone/:id': ['STAFF'],
  'DELETE /livestock/waste/zone/:id': ['STAFF'],

  // Users
  'GET /users': ['SUPER_ADMIN', 'VETERINER', 'STAFF'],
  'POST /users': ['SUPER_ADMIN'],
  'GET /users/:id': ['SUPER_ADMIN', 'VETERINER', 'STAFF'],
  'PATCH /users/:id': ['SUPER_ADMIN', 'VETERINER', 'STAFF'],
  'DELETE /users/:id': ['SUPER_ADMIN'],
  'PATCH /users/:id/role': ['SUPER_ADMIN'],
  'PATCH /users/:id/status': ['SUPER_ADMIN'],
  'PATCH /users/:id/reset-password': ['SUPER_ADMIN'],
  'DELETE /users/:id/revoke-access': ['SUPER_ADMIN'],
  'GET /users/:id/activity': ['SUPER_ADMIN', 'VETERINER', 'STAFF'],

  // Zones
  'POST /zones': ['SUPER_ADMIN'],
  'POST /zones/:id/sections': ['SUPER_ADMIN'],
  'DELETE /zones/sections/:id': ['SUPER_ADMIN'],
  'PATCH /zones/:id': ['SUPER_ADMIN'],
  'DELETE /zones/:id': ['SUPER_ADMIN'],
};

function injectTests(items) {
  items.forEach(item => {
    if (item.item) {
      injectTests(item.item);
    } else if (item.request) {
      // Find matching rule
      const method = item.request.method.toUpperCase();
      let path = '/' + item.request.url.path.join('/');
      
      const routeKey = `${method} ${path}`;
      const allowedRoles = rbacRules[routeKey];

      if (allowedRoles && item.event) {
        // Find the test script event
        const testEvent = item.event.find(e => e.listen === 'test');
        if (testEvent && testEvent.script && testEvent.script.exec) {
          
          const scriptCode = `
// OTOMATIS: Pengujian RBAC (Role-Based Access Control)
const currentRole = pm.environment.get("currentRole");
const allowedRoles = ${JSON.stringify(allowedRoles)};

// SUPER_ADMIN (Manager) di sistem ini memiliki akses penuh ke banyak hal, 
// tapi berdasarkan rules ketat yang kita set, kita cek:
const isAllowed = allowedRoles.includes(currentRole);

pm.test("[${method}] ${path} - Akses untuk " + (currentRole || 'Tanpa Role'), function () {
    if (!currentRole) {
        // Jika belum login / tidak ada role
        pm.response.to.have.status(401);
    } else if (!isAllowed) {
        // Jika Role ditolak
        pm.response.to.have.status(403);
    } else {
        // Jika Role diizinkan, kita harapkan 2xx
        pm.response.to.be.success;
    }
});
          `;
          
          testEvent.script.exec = scriptCode.split('\\n');
        }
      }
    }
  });
}

injectTests(collection.item);
fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2));
console.log('RBAC Tests Injected successfully!');
