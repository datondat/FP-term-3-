// Diagnostic script — save as check-setup.js in project root and run: node check-setup.js
const fs = require('fs');
const path = require('path');

function exists(p) {
  try { return fs.existsSync(p); } catch(e) { return false; }
}

const root = process.cwd();
const expectedFiles = [
  'server.js',
  'package.json',
  '.env',
  path.join('src','db.js'),
  path.join('src','routes','assignments.js'),
  path.join('src','routes','submissions.js'),
];

console.log('Project root:', root);
console.log('Node version:', process.version);
console.log('');
console.log('Checking expected files:');
expectedFiles.forEach(f => {
  const full = path.join(root, f);
  console.log(` - ${f}: ${exists(full) ? 'FOUND' : 'MISSING'}${exists(full) ? ' -> ' + full : ''}`);
});

console.log('');
// try resolve some modules used by server.js
const modules = ['cors','morgan','express','pg','multer','googleapis'];
console.log('Checking modules resolution (installed in node_modules):');
modules.forEach(m => {
  try {
    const r = require.resolve(m);
    console.log(` - ${m}: RESOLVED -> ${r}`);
  } catch (err) {
    console.log(` - ${m}: NOT RESOLVED (${err.code || err.message})`);
  }
});

console.log('');
// try simple require of server.js (but don't run it)
console.log('Attempting to require server.js (only load module, not execute HTTP listen if present)');
try {
  // load in a VM-like isolated require by clearing from cache first
  delete require.cache[require.resolve(path.join(root,'server.js'))];
  require(path.join(root,'server.js'));
  console.log(' - require(server.js): OK (server module loaded)');
} catch (err) {
  console.log(' - require(server.js): FAILED');
  console.log('   Error stack / message:');
  console.log(err && err.stack ? err.stack.split('\n').slice(0,10).join('\n') : String(err));
  console.log('   (Full error will appear when running npm start)');
}

console.log('');
console.log('Tips: If require(server.js) fails with "Cannot find module" for a path, check that the required file exists and the require path is correct (relative to server.js).');
console.log('If server starts but you still see "Cannot POST /api/submissions" in browser, that usually means the request hit the frontend dev server (port mismatch) rather than the backend.');