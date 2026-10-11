/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import { createMemo, Show } from 'solid-js';
import { Select, SelectContent, SelectItem, SelectLabel, SelectPortal, SelectTrigger, SelectValue } from '@/components/ui/select';
import './skill-scope-select.css';

type ScopeOption = {id: string; label: string; disabled: boolean};
export function SkillScopeSelect(props: {value: string; selection: string; onChange(value: string): void}) {
  const options = createMemo<ScopeOption[]>(()=>[
    {id:'scene',label:'Video completo',disabled:false},
    {id:'selection',label:'Selección actual',disabled:props.selection==='Sin selección'},
  ]);
  return <div class="syka-skill-scope" onKeyDown={event=>event.stopPropagation()} onKeyUp={event=>event.stopPropagation()}>
    <Select<ScopeOption> value={options().find(option=>option.id===props.value)}
      onChange={option=>{if(option)props.onChange(option.id);}} options={options()}
      optionValue="id" optionTextValue="label" optionDisabled="disabled"
      itemComponent={item=><SelectItem item={item.item}>{item.item.rawValue.label}</SelectItem>}>
      <SelectLabel class="text-[10px] text-muted-foreground">Aplicar a</SelectLabel>
      <SelectTrigger aria-label="Alcance al ejecutar" class="!h-8 !text-[11px]">
        <SelectValue<ScopeOption>>{state=>state.selectedOption()?.label}</SelectValue>
      </SelectTrigger>
      <SelectPortal><SelectContent class="syka-scope-menu !rounded-lg !p-1" onKeyDown={event=>event.stopPropagation()} onKeyUp={event=>event.stopPropagation()} /></SelectPortal>
    </Select>
    <Show when={props.selection==='Sin selección'}><p class="syka-panel-note">Seleccioná un clip para aplicar la skill sólo a ese elemento.</p></Show>
  </div>;
}
