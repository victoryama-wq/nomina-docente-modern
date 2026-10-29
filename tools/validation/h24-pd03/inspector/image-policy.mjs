import sharp from 'sharp';
import { PolicyRejection } from './pdf-policy.mjs';

sharp.cache(false);
sharp.concurrency(1);
const reject = () => { throw new PolicyRejection('IMAGE_POLICY_REJECTED'); };
function jpegEnvelope(bytes) {
  if (bytes[0] !== 255 || bytes[1] !== 216) reject();
  let position = 2;
  let scanned = false;
  while (position < bytes.length) {
    if (bytes[position++] !== 255) reject();
    while (bytes[position] === 255) position++;
    const marker = bytes[position++];
    if (marker === 217) { if (!scanned || position !== bytes.length) reject(); return; }
    if (marker === 216 || marker === 0 || marker === undefined || (marker >= 208 && marker <= 215)) reject();
    if (position + 2 > bytes.length) reject();
    const length = bytes.readUInt16BE(position);
    if (length < 2 || position + length > bytes.length) reject();
    if (marker === 226 && bytes.subarray(position + 2, position + 6).equals(Buffer.from('MPF\0'))) reject();
    position += length;
    if (marker === 218) {
      scanned = true;
      // Only frame markers; libvips still decodes the entropy data. Disallow a second JPEG/trailing payload.
      while (position < bytes.length) {
        if (bytes[position] !== 255) { position++; continue; }
        let next = position + 1;
        while (bytes[next] === 255) next++;
        if (bytes[next] === 0 || (bytes[next] >= 208 && bytes[next] <= 215)) { position = next + 1; continue; }
        break;
      }
    }
  }
  reject();
}
export async function validateImage(bytes, format) {
  if (!['jpeg', 'png'].includes(format)) reject();
  if (format === 'png') {
    if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) reject();
    let position = 8;
    let ended = false;
    // Chunk framing only; libvips performs actual image decoding. Never accept APNG's first frame only.
    while (position < bytes.length) {
      if (position + 12 > bytes.length) reject();
      const length = bytes.readUInt32BE(position);
      if (length > bytes.length - position - 12) reject();
      const type = bytes.subarray(position + 4, position + 8).toString('ascii');
      if (['acTL', 'fcTL', 'fdAT'].includes(type)) reject();
      position += length + 12;
      if (type === 'IEND') { if (length !== 0 || position !== bytes.length) reject(); ended = true; break; }
    }
    if (!ended) reject();
  } else jpegEnvelope(bytes);
  const options = { failOn: 'warning', limitInputPixels: 25_000_000, unlimited: false, sequentialRead: true };
  try {
    const metadata = await sharp(bytes, options).metadata();
    if (metadata.format !== format || !metadata.width || !metadata.height || metadata.width > 10_000 ||
        metadata.height > 10_000 || metadata.width * metadata.height > 25_000_000 ||
        (metadata.pages ?? 1) !== 1 || metadata.delay || metadata.loop !== undefined) reject();
    // Force full decoding into bounded, disposable pixels. Do not save transformed originals.
    const { data, info } = await sharp(bytes, options).raw().toBuffer({ resolveWithObject: true });
    if (info.width !== metadata.width || info.height !== metadata.height || data.length !== info.width * info.height * info.channels || data.length > 100_000_000) reject();
  } catch (error) {
    if (error instanceof PolicyRejection) throw error;
    // Resource/system failures must never be reported as a clean or ordinary invalid file.
    if (/memory|alloc|timeout|resource|EMFILE|ENOSPC/i.test(String(error))) throw new Error('IMAGE_UNAVAILABLE');
    reject();
  }
}
