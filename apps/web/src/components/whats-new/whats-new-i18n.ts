/**
 * Lo mínimo de `@bb/shared-ui/lib/i18n` (Syka Legacy) que usan los archivos de
 * «Novedades» copiados tal cual de Kevin: catálogos en inglés y español, con
 * `{variable}`. Syka Code va en español, así que se lee el catálogo `es`.
 */

export type Locale = 'en' | 'es'

export type MessageCatalog<T extends Readonly<Record<string, string>> = Readonly<Record<string, string>>> = { readonly en: T; readonly es: T }

type Vars = Readonly<Record<string, string | number>> | undefined

function fill(text: string, vars: Vars): string {
  if (vars === undefined) return text
  return text.replace(/\{(\w+)\}/gu, (whole, name: string) => (name in vars ? String(vars[name]) : whole))
}

export function translate<C extends MessageCatalog>(catalog: C, key: Extract<keyof C['en'], string>, vars?: Vars, locale: Locale = 'es'): string {
  const table = catalog[locale] as Readonly<Record<string, string>>
  return fill(table[key] ?? (catalog.en as Readonly<Record<string, string>>)[key] ?? key, vars)
}

/** Como en Syka Legacy: un hook que devuelve `t(clave, variables)`. */
export function defineMessages<C extends MessageCatalog>(catalog: C): () => (key: Extract<keyof C['en'], string>, vars?: Vars) => string {
  const t = (key: Extract<keyof C['en'], string>, vars?: Vars): string => translate(catalog, key, vars)
  return () => t
}
