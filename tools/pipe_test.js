// Pipe control test client for the Unity engine bridge.
// Usage: node pipe_test.js <pipeName> <cmdJson> [<cmdJson> ...]
const net = require('net');

const pipeName = process.argv[2];
const commands = process.argv.slice(3).map((s) => JSON.parse(s));

const client = net.connect({ path: '\\\\.\\pipe\\' + pipeName });
let buf = '';
let index = 0;

client.on('connect', () => {
  console.log('[client] connected');
  sendNext();
});

client.on('data', (d) => {
  buf += d.toString('utf8');
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (line) {
      console.log('[resp]', line);
      sendNext();
    }
  }
});

client.on('error', (e) => {
  console.error('[client] error:', e.message);
  process.exit(1);
});

client.on('close', () => {
  console.log('[client] closed');
  process.exit(0);
});

function sendNext() {
  if (index >= commands.length) {
    setTimeout(() => client.end(), 300);
    return;
  }
  const cmd = commands[index++];
  console.log('[send]', JSON.stringify(cmd));
  client.write(JSON.stringify(cmd) + '\n');
}
