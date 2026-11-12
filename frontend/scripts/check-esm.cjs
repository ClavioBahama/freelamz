/* Verifica sintaxe ESM dos ficheiros frontend copiando para .mjs temporários */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const files = process.argv.slice(2);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fz-check-'));
let falhas = 0;
for (const f of files) {
  const dest = path.join(tmp, path.basename(f).replace(/\.[^.]+$/, '') + '-' + Date.now() + Math.random().toString(36).slice(2, 6) + '.mjs');
  fs.copyFileSync(f, dest);
  try {
    execFileSync('node', ['--check', dest], { stdio: 'pipe' });
    console.log('OK  ', f);
  } catch (e) {
    falhas++;
    console.error('ERRO', f);
    console.error(String(e.stderr || e.message).slice(0, 500));
  } finally {
    try { fs.unlinkSync(dest); } catch (e) {}
  }
}
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
process.exit(falhas ? 1 : 0);
