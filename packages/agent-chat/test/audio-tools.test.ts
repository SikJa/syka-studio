import {describe,it,expect} from 'vitest';
import {readLoudnessMeasurement,enhanceAudio} from '../src/host/audio-tools';
describe('local audio enhancement',()=>{
  it('extracts measured values and rejects nonfinite silence',()=>{
    expect(readLoudnessMeasurement('log\n{"input_i":"-20.0","input_tp":"-3.2","input_lra":"4.3","input_thresh":"-31.0","target_offset":"0.1"}\n')).toEqual({input_i:-20,input_tp:-3.2,input_lra:4.3,input_thresh:-31,target_offset:.1});
    expect(()=>readLoudnessMeasurement('{"input_i":"-inf","input_tp":"-inf","input_lra":"0","input_thresh":"-70","target_offset":"inf"}')).toThrow('silencio');
    expect(()=>readLoudnessMeasurement('no audio')).toThrow('medición');
    expect(()=>readLoudnessMeasurement('{"input_i":null}')).toThrow('silencio');
  });
  it('rejects remote media and unsupported profiles before launching a process',async()=>{
    await expect(enhanceAudio('C:/project','ffmpeg',{source:'https://example.com/a.mp4'})).rejects.toThrow('absolute local');
    const local=process.platform==='win32'?'C:/test.wav':'/tmp/test.wav';
    await expect(enhanceAudio('.',undefined,{source:local,profile:'neural'})).rejects.toThrow('Unknown audio');
    await expect(enhanceAudio('.',undefined,{source:local})).rejects.toThrow('FFmpeg');
  });
});
