import {afterEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({write:vi.fn(),restamp:vi.fn(),discard:vi.fn(),refresh:vi.fn()}));
vi.mock('./host',()=>({writeProject:mocks.write}));
vi.mock('@/engine/editor',()=>({getDocumentEditor:()=>({restamp:mocks.restamp,discardPending:mocks.discard,unsettle:vi.fn()})}));
vi.mock('@/engine/history',()=>({getEditHistory:()=>({gestureGroup:()=> 'gesture',refresh:mocks.refresh})}));
vi.mock('somoto',()=>({toast:{error:vi.fn()}}));
import {createEditWriter} from './edits';
import type {World} from 'koota';
afterEach(()=>vi.clearAllMocks());
describe('failed project write retry',()=>{
 it('keeps the failed batch and buffered later edits in order on explicit retry',async()=>{
  mocks.write.mockResolvedValueOnce({error:'No files were written',skipped:[]})
   .mockResolvedValue({skipped:[],ids:{}});
  const writer=createEditWriter('F:/qa/retry',{} as World);
  try{
   writer.push({kind:'prop',source:'index.tsx:video',name:'gain',value:0.5});
   await expect(writer.drain()).rejects.toThrow('No files were written');
   expect(mocks.restamp).not.toHaveBeenCalled();
   writer.push({kind:'prop',source:'index.tsx:video',name:'gain',value:0.8});
   await writer.drain();
   expect(mocks.write).toHaveBeenCalledTimes(3);
   expect(mocks.write.mock.calls[0]?.[1]).toEqual(mocks.write.mock.calls[1]?.[1]);
   expect(mocks.write.mock.calls[2]?.[1]).toEqual([{kind:'set',source:'index.tsx:video',props:{gain:0.8}}]);
   expect(mocks.restamp).toHaveBeenCalledTimes(2);
  }finally{writer.dispose();}
 });
});
