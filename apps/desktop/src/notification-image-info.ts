/** Read dimensions before handing compressed input to a decoder. */
export function notificationImageInfo(data: Buffer) {
  let mimeType = '', extension = '', width = 0, height = 0;
  if (data.length >= 24 && data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    mimeType = 'image/png'; extension = 'png'; width = data.readUInt32BE(16); height = data.readUInt32BE(20);
  } else if (data.length >= 10 && /^GIF8[79]a$/.test(data.subarray(0, 6).toString('ascii'))) {
    mimeType = 'image/gif'; extension = 'gif'; width = data.readUInt16LE(6); height = data.readUInt16LE(8);
  } else if (data.length >= 25 && data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP') {
    mimeType = 'image/webp'; extension = 'webp';
    const kind = data.subarray(12, 16).toString('ascii');
    if (kind === 'VP8X' && data.length >= 30) { width = data.readUIntLE(24, 3) + 1; height = data.readUIntLE(27, 3) + 1; }
    else if (kind === 'VP8L' && data[20] === 47) { const bits = data.readUInt32LE(21); width = (bits & 16383) + 1; height = ((bits >>> 14) & 16383) + 1; }
    else if (kind === 'VP8 ' && data.length >= 30 && data.subarray(23, 26).equals(Buffer.from([157,1,42]))) { width = data.readUInt16LE(26) & 16383; height = data.readUInt16LE(28) & 16383; }
  } else if (data[0] === 255 && data[1] === 216 && data[2] === 255) {
    mimeType = 'image/jpeg'; extension = 'jpg';
    for (let offset = 2; offset + 3 < data.length;) {
      if (data[offset++] !== 255) break;
      while (data[offset] === 255) offset++;
      const marker = data[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || marker === 216) continue;
      if (offset + 2 > data.length) break;
      const length = data.readUInt16BE(offset);
      if (length < 2 || offset + length > data.length) break;
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker!) && length >= 7) { height = data.readUInt16BE(offset + 3); width = data.readUInt16BE(offset + 5); break; }
      offset += length;
    }
  }
  if (!mimeType || !width || !height) throw Error('Usá una foto PNG, JPG, WebP o GIF válida.');
  if (width > 16384 || height > 16384 || width * height > 40_000_000) throw Error('Las dimensiones de la foto son demasiado grandes.');
  return { mimeType, extension, width, height };
}
