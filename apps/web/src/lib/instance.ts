/**
 * «Pruebas»: the build from source that runs beside the daily Syka, with its
 * own data. Main opens its window with `?instance=pruebas`; the badge makes it
 * impossible to confuse the two.
 */
export const TESTING_INSTANCE = typeof location !== 'undefined' && new URLSearchParams(location.search).get('instance') === 'pruebas';

if (TESTING_INSTANCE && typeof document !== 'undefined') document.documentElement.dataset.sykaInstance = 'pruebas';
