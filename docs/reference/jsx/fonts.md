# Fonts

Discover available fonts with [`fonts`](../tools/fonts.md), filtering by family, weight or style. Syka lists included fonts (`included`), native user imports (`imported`) and permitted OS fonts (`system`). Included fonts ship with their licenses and work offline on every Syka installation. Native imports are copied into the user's profile and survive restarts; they do not grant redistribution rights or become part of Syka's installer.

Check `missingSpanish` before choosing a font for Spanish captions. Use the actual weights/styles returned by the tool. Prefer included families for portable projects; keep a consistent pair for titles and body rather than randomly changing fonts within one scene. A user's imported family must also be imported/licensed on another machine. The native importer supports OTF, TTF and all faces of a TTC collection.

## Native `<text>`

Name a family on [`<text>`](./text.md) or [`<captions>`](./captions.md) with `fontFamily`; pick a real variant with `fontWeight` and `fontStyle`. Syka loads included/imported native text fonts automatically, and capture waits for the font before rendering. Use the family name; do not paste a native font identifier or inline bytes into JSX. Unknown names fall back to a browser default.

```tsx
<text fontFamily="Inter" fontWeight={700} fontSize={128} textAlign="center" textBaseline="middle">
  Hello World
</text>
```

## HTML

In [`<html>`](./html.md) you style text with ordinary CSS, so **use a locally installed font** and name it directly. The browser resolves the family from the OS:

```tsx
<html width={700} height={110}>
  <div style="font:500 40px Inter;color:#fff;">Introduction</div>
</html>
```

Remote web fonts work too (a Google Fonts `<link>`, or an `@font-face` with a `url()` source). However the cost is that every render then depends on the network and on the font host staying up, so a local family from [`fonts`](../tools/fonts.md) is the safer default for anything you have to be able to re-render on demand.

If you want to pin an exact variant, declare an `@font-face` whose source is the CSS `local()` string that `fonts` reports for that variant (never a `url()`):

```tsx
<html width={700} height={110}>
  <style>{`
    @font-face {
      font-family: "Inter Display";
      font-weight: 700;
      src: local('Inter Display Bold'), local('Inter-DisplayBold');
    }
  `}</style>
  <div style="font:700 40px 'Inter Display';color:#fff;">Introduction</div>
</html>
```
