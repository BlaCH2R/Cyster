const fs = require('fs');
const p = 'app/main.js';
const lines = fs.readFileSync(p, 'utf8').split('\n');
const start = lines.findIndex((l) => l.includes('async function captureScreenViaPowershell'));
if (start < 0) throw new Error('function marker not found');
lines.splice(start);
while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
fs.writeFileSync(p, lines.join('\n') + '\n', 'utf8');
console.log('removed', 1123 - start, 'lines');
