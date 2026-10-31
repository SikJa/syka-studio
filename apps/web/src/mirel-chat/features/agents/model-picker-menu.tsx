/** @jsxImportSource react */
import { useEffect, useMemo, useState, type RefObject } from 'react';
import { Check, Globe2, Search, Settings2, Star, Zap } from 'lucide-react';
import { EffortSlider } from './effort-slider';
import { filterPickerModels, modelProviderId } from './model-picker-options';
import { toggleModelFavorite, useModelPickerPreferences } from './model-picker-preferences';
import type { AgentComposerEffortOption, AgentComposerModelOption } from './agent-composer';
import './model-picker-menu.css';

export type AgentComposerProviderOption = { id: string; label: string; logoSvg?: string; detail?: string; ready: boolean };
export function StudioModelMenu({ id, panelRef, models, providers: suppliedProviders, selectedModel, selectedModelId, efforts, selectedEffortId, defaultEffortId,
  fast, fastAvailable, fastUnavailableReason, onFastChange, onModelChange, onEffortChange, onConfigureProviders, onClose }: {
  id: string; panelRef: RefObject<HTMLDivElement | null>; models: readonly AgentComposerModelOption[]; providers?: readonly AgentComposerProviderOption[];
  selectedModel?: AgentComposerModelOption; selectedModelId?: string; efforts: readonly AgentComposerEffortOption[]; selectedEffortId?: string; defaultEffortId?: string;
  fast: boolean; fastAvailable: boolean; fastUnavailableReason: string; onFastChange?: (value: boolean) => void;
  onModelChange?: (id: string) => void; onEffortChange?: (id: string) => void; onConfigureProviders?: () => void; onClose: () => void;
}) {
  const { orientation, favorites } = useModelPickerPreferences();
  const providers = useMemo<readonly AgentComposerProviderOption[]>(() => suppliedProviders ?? [...new Map(models.map(m => [modelProviderId(m), { id: modelProviderId(m), label: m.providerLabel ?? modelProviderId(m), logoSvg: m.logoSvg, ready: true }])).values()], [models, suppliedProviders]);
  const [providerId, setProviderId] = useState(() => selectedModel ? modelProviderId(selectedModel) : providers[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  useEffect(() => { if (!providers.some(p => p.id === providerId)) setProviderId(providers[0]?.id ?? ''); }, [providers, providerId]);
  const provider = providers.find(p => p.id === providerId);
  const visible = filterPickerModels(models, providerId, search, favoritesOnly, favorites);
  const showingSelectedProvider = provider?.ready === true && selectedModel !== undefined && modelProviderId(selectedModel) === providerId;
  const showEffort = showingSelectedProvider && efforts.length > 1;
  const showFast = showingSelectedProvider && fastAvailable;
  const chooseProvider = (id: string) => { setProviderId(id); setSearch(''); };
  const firstModel = () => panelRef.current?.querySelector<HTMLButtonElement>('[role="option"]:not(:disabled)')?.focus();
  return <div ref={panelRef} id={id} className="syka-studio-model-picker" data-effort-layout={orientation} role="dialog" aria-label="Ajustes de modelo"
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    <div className="syka-studio-picker-body">
      <nav className="syka-studio-provider-rail" aria-label="Motores">
        <button type="button" aria-label="Mostrar favoritos" title="Favoritos del motor actual" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(value => !value)}><Star size={16}/></button>
        {providers.map(p => <button key={p.id} type="button" aria-label={p.label} aria-pressed={p.id === providerId} title={`${p.label}${p.ready ? '' : ` · ${p.detail ?? 'Sin conexión'}`}`}
          data-ready={p.ready} onClick={() => chooseProvider(p.id)} onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); firstModel(); } }}>
          {p.logoSvg ? <span className="syka-studio-provider-logo" aria-hidden="true" dangerouslySetInnerHTML={{ __html: p.logoSvg }}/> : <Globe2 size={19}/>}
        </button>)}
        {onConfigureProviders ? <button type="button" className="syka-studio-picker-configure" aria-label="Configurar agentes y modelos" title="Configurar agentes y modelos" onClick={() => { onClose(); onConfigureProviders(); }}><Settings2 size={16}/></button> : null}
      </nav>
      <div className="syka-studio-picker-main" data-has-controls={showEffort || showFast}>
        <div className="syka-studio-picker-center">
          <header><span title={provider?.detail}>{provider?.label ?? 'Modelos'}</span><label className="syka-studio-picker-search"><Search size={13} aria-hidden="true"/>
            <input autoFocus type="search" aria-label="Buscar modelo" placeholder="Buscar modelo" value={search} onChange={e => setSearch(e.currentTarget.value)} onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); firstModel(); } }}/></label></header>
          <div className="syka-studio-picker-models" role="listbox" aria-label={`Modelos de ${provider?.label ?? 'Syka'}`}
            onKeyDown={event => {
              if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key) || !(event.target instanceof HTMLElement) || event.target.getAttribute('role') !== 'option') return;
              const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)'));
              if (!buttons.length) return;
              const current = buttons.indexOf(event.target as HTMLButtonElement), next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
              event.preventDefault();buttons[next]?.focus();
            }}>
            {visible.map(model => <div className="syka-studio-picker-row" key={model.id} data-selected={model.id === selectedModelId}>
              <button type="button" className="syka-studio-picker-favorite" aria-label={`Favorito: ${model.label}`} aria-pressed={favorites.includes(model.id)} onClick={() => toggleModelFavorite(model.id)}><Star size={14}/></button>
              <button type="button" role="option" aria-selected={model.id === selectedModelId} disabled={!onModelChange || model.disabled} title={model.disabledReason ?? model.description ?? model.label} onClick={() => onModelChange?.(model.id)}>
                {model.logoSvg ? <span className="syka-studio-model-logo" aria-hidden="true" dangerouslySetInnerHTML={{__html:model.logoSvg}}/> : null}
                <span className="syka-studio-model-name"><span>{model.label}</span>{model.routeLabel ? <small>{model.routeLabel}</small> : null}</span>
                {model.id === selectedModelId ? <Check size={13} aria-hidden="true"/> : null}
              </button>
            </div>)}
            {!visible.length ? <p className="syka-studio-picker-empty" role="status">{!provider?.ready ? provider?.detail ?? 'Conectá un proveedor para ver sus modelos.' : search ? 'No hay modelos que coincidan.' : favoritesOnly ? 'No hay favoritos en este motor.' : 'No hay modelos visibles. Revisá la configuración.'}</p> : null}
          </div>
        </div>
        {showEffort || showFast ? <div className="syka-studio-picker-effort">
          {showEffort ? <EffortSlider efforts={efforts} value={selectedEffortId} defaultValue={defaultEffortId} orientation={orientation} fast={fast && fastAvailable} onChange={onEffortChange}/> : <span className="syka-studio-no-effort">Sin ajuste de esfuerzo</span>}
          {showFast ? <button type="button" className="syka-studio-picker-fast" role="switch" aria-label="Modo rápido" aria-checked={fast && fastAvailable} disabled={!onFastChange} title={fastAvailable ? 'Aplica al próximo envío y puede consumir más cuota del proveedor.' : fastUnavailableReason} onClick={() => onFastChange?.(!fast)}><Zap size={12}/>Fast</button> : null}
        </div> : null}
      </div>
    </div>
  </div>;
}
