# fonts

List included Syka fonts, native user imports and permitted system fonts. Family names are valid `fontFamily` values on native text and captions; variants report real weights and styles. Included/imported fonts remain discoverable when OS font access is disabled. `origin`, `license` and `missingSpanish` help choose portable, language-compatible typography. Native imports return a short identifier rather than font bytes.

| | |
| --- | --- |
| MCP tool | `fonts` |
| CLI | `diffusion fonts [options]` |

## Input

| Field | Type | CLI | Description |
| --- | --- | --- | --- |
| `family` | `string` | `-f, --family <pattern>` | filter to families whose name contains this (case-insensitive) |
| `weights` | `string[]` | `-w, --weights <weights...>` | filter to variants with the given CSS weights, e.g. ["400", "700"] |
| `style` | `"normal" \| "italic"` | `-s, --style <style>` | filter to variants with the given style, normal or italic |
| `limit` | `integer` | `-l, --limit <n>` | return at most this many families (default: 50) |

Font families listed here are valid `fontFamily` values on [`<text>`](../jsx/text.md); see [jsx/fonts.md](../jsx/fonts.md) for how a family and variant are named in a composition, and [`context`](./context.md) for the families the open project has actually registered.

A machine has hundreds of families, so filter by `family` when looking for one. `total` counts every family the filters match; when it is larger than `families.length`, the limit cut the list.

## Output

One JSON object:

```ts
{
  families: Array<{
    family:   string;
    variants: Array<{
      weight: string;            // CSS weight, e.g. "400"
      style:  "normal" | "italic";
      source: string;            // CSS local() source
    }>;
  }>;
  total: number;                 // families matching the filters, before the limit
}
```
