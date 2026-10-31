/** @jsxImportSource react */
import { useId } from 'react';
import { RotateCcw } from 'lucide-react';
import { ReasoningEffort } from './reasoning-effort/ReasoningEffort';
import { declaredEffortDefault } from './model-picker-options';
import type { EffortOrientation } from './model-picker-preferences';
import './effort-slider.css';
export function EffortSlider({ efforts, value, defaultValue, orientation = 'vertical', fast = false, onChange }: {
  efforts: readonly { id: string; label: string }[]; value?: string; defaultValue?: string; orientation?: EffortOrientation; fast?: boolean; onChange?: (id: string) => void;
}) {
 const titleId = useId(), selected = efforts.findIndex(e => e.id === value), index = Math.max(0, selected), reset = declaredEffortDefault(efforts, defaultValue);
 if (efforts.length < 2) return null;
 return <div className="syka-effort syka-effort-compact" data-orientation={orientation} data-effort-slider="">
   <div className="syka-effort-head"><span id={titleId} className="syka-effort-title">Esfuerzo</span>
     {reset !== undefined ? <button type="button" className="syka-effort-reset" aria-label="Restablecer el esfuerzo" title="Restablecer el esfuerzo predeterminado del modelo" disabled={!onChange || reset === value} onClick={() => onChange?.(reset)}><RotateCcw size={13} aria-hidden="true"/></button> : null}
     <span className="syka-effort-value">{selected >= 0 ? efforts[selected].label : 'Automático'}</span></div>
   {orientation === 'vertical' ? <span className="syka-effort-endpoint">{efforts.at(-1)?.label}</span> : null}
   <div className="syka-effort-control"><ReasoningEffort key={JSON.stringify(efforts.map(e => e.id))} labels={efforts.map(e => e.label)} value={index} labelledBy={titleId} orientation={orientation} stretch={100} disabled={!onChange} effect={onChange ? fast ? 'fast' : value === 'max' || value === 'ultra' ? 'ultra' : undefined : undefined} onValueChange={next => { const option = efforts[next]; if (option && option.id !== value) onChange?.(option.id); }}/></div>
   {orientation === 'vertical' ? <span className="syka-effort-endpoint">{efforts[0]?.label}</span> : null}
 </div>;
}
