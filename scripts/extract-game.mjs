import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

// The supplied SWF wraps the original Flash 7 game in Mochi's Flash 10 loader.
// Decode its embedded payload exactly as mochicrypt.Preloader.finish() does.
// No game tags, artwork or ActionScript are edited.
const source = await readFile(new URL('../assets/tennis-championships.swf', import.meta.url));
if (createHash('sha256').update(source).digest('hex') !==
    '24e0ae48ecbc22a1148fa398a5ebddc189c2372a8757ced3ef5a688db914bc7e') {
  throw new Error('Unexpected source SWF; extraction is specific to the supplied game');
}
const body = inflateSync(source.subarray(8));
const rectBits = body[0] >>> 3;
let offset = Math.ceil((5 + 4 * rectBits) / 8) + 4;
let payload;
while (offset + 2 <= body.length) {
  const header = body.readUInt16LE(offset);
  offset += 2;
  const tag = header >>> 6;
  let length = header & 63;
  if (length === 63) {
    length = body.readUInt32LE(offset);
    offset += 4;
  }
  if (offset + length > body.length) throw new Error('Truncated SWF tag');
  // DefineBinaryData character 7 is mochicrypt.Payload.
  if (tag === 87 && length >= 6 && body.readUInt16LE(offset) === 7) {
    payload = Buffer.from(body.subarray(offset + 6, offset + length));
    break;
  }
  offset += length;
}
if (!payload || payload.length <= 32) throw new Error('Game payload is missing');
const length = payload.length - 32;
const key = payload.subarray(length);
const state = Uint8Array.from({ length: 256 }, (_, index) => index);
let j = 0;
for (let i = 0; i < 256; i++) {
  j = (j + state[i] + key[i & 31]) & 255;
  [state[i], state[j]] = [state[j], state[i]];
}
let i = 0;
j = 0;
for (let k = 0; k < Math.min(length, 131072); k++) {
  i = (i + 1) & 255;
  const u = state[i];
  j = (j + u) & 255;
  const v = state[j];
  state[i] = v;
  state[j] = u;
  payload[k] ^= state[(u + v) & 255];
}
const game = inflateSync(payload.subarray(0, length));
if (game.toString('ascii', 0, 3) !== 'FWS' || game[3] !== 7 ||
    game.readUInt32LE(4) !== game.length ||
    createHash('sha256').update(game).digest('hex') !==
    '6102095039f55eacb555d23e639afcbf0a7f2945f17fae6e515b1ad9b241c16f') {
  throw new Error('Invalid extracted Flash 7 game');
}
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await writeFile(new URL('../public/tennis-game.swf', import.meta.url), game);
console.log(`Original Flash 7 game extracted: ${game.length} bytes`);
