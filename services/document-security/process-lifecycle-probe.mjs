// Synthetic Linux regression: no documents, signatures, network or database.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, readFile } from 'node:fs/promises';

const exec = promisify(execFile);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function snapshot() {
  const processes = [];
  for (const id of await readdir('/proc')) {
    if (!/^\d+$/.test(id)) continue;
    try {
      const stat = await readFile(`/proc/${id}/stat`, 'utf8');
      const end = stat.lastIndexOf(')');
      const fields = stat.slice(end + 2).split(' ');
      processes.push({ pid: Number(id), name: stat.slice(stat.indexOf('(') + 1, end), state: fields[0], ppid: Number(fields[1]) });
    } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ESRCH') throw error; }
  }
  return { processes, pids: Number(await readFile('/sys/fs/cgroup/pids.current', 'utf8')) };
}

const before = await snapshot();
const count = Number(process.argv[2] || 20);
if (![20, 100].includes(count)) throw Error('Bounded probe required');
for (let i = 0; i < count; i++) {
  await exec('/bin/sh', ['-c', 'timeout -s KILL 115 /bin/true']);
  await pause(30);
}
// Also exercise real deadline exits, not only successful commands.
let deadlines = 0;
for (let i = 0; i < 2; i++) {
  try { await exec('/bin/sh', ['-c', 'timeout -s KILL 1 /bin/sleep 30']); }
  catch (error) { if (error.code === 137 || error.signal === 'SIGKILL') deadlines++; else throw error; }
}
await pause(1200);
console.log(JSON.stringify({ before, after: await snapshot(), count, deadlines }));
