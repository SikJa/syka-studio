import { describe, expect, it } from 'vitest';
import { notificationAttachmentInfo, validateNotificationVideo } from './notification-attachment-info';

describe('notification attachments', () => {
  it('accepts plain text and common Windows text encodings without rendering their content as markup', () => {
    for (const data of [Buffer.from('Títulos, música y <script>texto</script>'), Buffer.from([0xff,0xfe,...Buffer.from('Guía','utf16le')]), Buffer.from([0x47,0x75,0xed,0x61]), Buffer.alloc(0)]) {
      expect(notificationAttachmentInfo('GUÍA.TXT',data)).toEqual({kind:'text',extension:'txt',mimeType:'text/plain'});
    }
    expect(() => notificationAttachmentInfo('binario.txt', Buffer.from([0,1,2]))).toThrow(/binarios/);
    expect(() => notificationAttachmentInfo('grande.txt', Buffer.alloc(5*1024*1024+1))).toThrow(/5 MB/);
  });
  it('requires an actual video stream with the right container and bounded dimensions', () => {
    expect(() => validateNotificationVideo('mp4',{format:{format_name:'mov,mp4,m4a,3gp,3g2,mj2'},streams:[{codec_type:'video',width:1920,height:1080}]})).not.toThrow();
    expect(() => validateNotificationVideo('webm',{format:{format_name:'matroska,webm'},streams:[{codec_type:'video',width:720,height:1280}]})).not.toThrow();
    for (const metadata of [{format:{format_name:'mp3'},streams:[{codec_type:'audio'}]},{format:{format_name:'mov'},streams:[{codec_type:'video',width:20000,height:100}]},{format:{format_name:'mov'},streams:[]}]) {
      expect(() => validateNotificationVideo('mp4',metadata)).toThrow(/video válido/);
    }
  });
});
