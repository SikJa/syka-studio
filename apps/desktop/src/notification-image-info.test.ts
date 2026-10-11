import { expect, it } from 'vitest';
import { notificationImageInfo } from './notification-image-info';
it('rejects disguised text and decompression-sized PNG dimensions before decoding', () => {
  expect(() => notificationImageInfo(Buffer.from('not an image'))).toThrow('válida');
  const data = Buffer.alloc(24); Buffer.from([137,80,78,71,13,10,26,10]).copy(data); data.writeUInt32BE(100000,16); data.writeUInt32BE(100000,20);
  expect(() => notificationImageInfo(data)).toThrow('demasiado grandes');
});
it('reads lossless and extended WebP sizes as well as real GIF dimensions', () => {
  const data = Buffer.alloc(30); data.write('RIFF',0); data.write('WEBP',8); data.write('VP8X',12); data.writeUIntLE(127,24,3); data.writeUIntLE(63,27,3);
  expect(notificationImageInfo(data)).toMatchObject({mimeType:'image/webp',width:128,height:64});
  data.write('VP8L',12); data[20]=47; data.writeUInt32LE((127 | (63 << 14)) >>> 0,21);
  expect(notificationImageInfo(data)).toMatchObject({width:128,height:64});
  expect(notificationImageInfo(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64'))).toMatchObject({mimeType:'image/gif',width:1,height:1});
});
