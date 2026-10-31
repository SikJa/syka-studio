import type { ChatEvent, Item } from '../protocol';
/** Stamp receipt once on live events. Replaying old logs never invents dates. */
export function timestampEvent(event:ChatEvent,items:Item[],now=Date.now()):ChatEvent{
  if(event.type==='turn.started')return {...event,user:{...event.user,createdAt:event.user.createdAt??now}};
  if(event.type==='item.started'||event.type==='item.completed'){
    const existing=items.find(item=>item.id===event.item.id);
    return {...event,item:{...event.item,createdAt:existing?.createdAt??event.item.createdAt??now,...(event.type==='item.completed'?{completedAt:event.item.completedAt??now}:{})}};
  }
  return event;
}
