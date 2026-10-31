// Synthetic pixels only, generated with the inspector's already installed decoder.
import sharp from '/opt/h24/node_modules/sharp/dist/index.cjs';
import { randomBytes, createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const items = [
  ['small.png', await sharp({ create: { width: 32, height: 32, channels: 3, background: '#abcdef' } }).png().toBuffer()],
  ['large.png', await sharp(randomBytes(1600 * 1600 * 3), { raw: { width: 1600, height: 1600, channels: 3 } }).png().toBuffer()],
  ['large.jpg', await sharp(randomBytes(2000 * 2000 * 3), { raw: { width: 2000, height: 2000, channels: 3 } }).jpeg({ quality: 95 }).toBuffer()],
  ['25mp.png', await sharp({ create: { width: 5000, height: 5000, channels: 3, background: '#abcdef' } }).png().toBuffer()]
];
const manifest = [];
for (const [name, bytes] of items) {
  if (bytes.length > 7864320) throw Error('Fixture over limit');
  await writeFile(`/evidence/${name}`, bytes);
  manifest.push({ name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile('/evidence/images.json', JSON.stringify(manifest, null, 2));
