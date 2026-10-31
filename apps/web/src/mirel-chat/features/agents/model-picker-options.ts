export type PickerModel = {
  id: string; label: string; providerId?: string; providerLabel?: string; description?: string;
  routeLabel?: string; logoSvg?: string; disabled?: boolean; disabledReason?: string;
};
export const modelProviderId = (model: PickerModel) => model.providerId ?? model.id.slice(0, model.id.indexOf(':'));
export function filterPickerModels(models: readonly PickerModel[], provider: string, search: string, favoritesOnly: boolean, favorites: readonly string[]) {
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const query = normalize(search.trim());
  return models.filter(model => modelProviderId(model) === provider && (!favoritesOnly || favorites.includes(model.id)) && normalize(`${model.label} ${model.providerLabel ?? ''} ${model.description ?? ''}`).includes(query));
}
export function declaredEffortDefault(efforts: readonly { id: string }[], value?: string) {
  return value !== undefined && efforts.some(e => e.id === value) ? value : undefined;
}
