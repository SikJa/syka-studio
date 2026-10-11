import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { localizeUi, uiI18nPlugin } from './ui-i18n.mjs';

const require = createRequire(import.meta.url);
const babel = require('@babel/core');
const traverse = require('@babel/traverse').default;
const ts = require('typescript');
const { TraceMap, originalPositionFor } = require('@jridgewell/trace-mapping');
const filename = 'F:/syka/apps/web/src/components/i18n-fixture.tsx';

test('localizes nested JSX in conditional branches and attribute slots', () => {
  const source = `export const view = <section>{enabled ? <button>Save</button> : <span>Cancel</span>}<Panel title={enabled ? <b>Tools</b> : <b>Settings</b>} /></section>;`;
  const output = localizeUi(source, filename);
  const dictionary = new Map([['Save', 'Guardar'], ['Cancel', 'Cancelar'], ['Tools', 'Herramientas'], ['Settings', 'Configuración']]);
  const Panel = 'Panel';
  const { view } = run(output.code, { enabled: false, Panel }, dictionary);
  assert.equal(view.children[0].children[0], 'Cancelar');
  assert.equal(view.children[1].props.title.children[0], 'Configuración');
  assert.equal(localizeUi(output.code, filename).code, output.code);
});

function parse(code) {
  return babel.parseSync(code, { configFile: false, babelrc: false, parserOpts: { plugins: ['typescript', 'jsx'] } });
}

function run(code, variables = {}, translations = new Map()) {
  const module = { exports: {} };
  const output = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, jsxFactory: 'h' },
  });
  vm.runInNewContext(output.outputText, {
    module, exports: module.exports,
    require: name => {
      assert.equal(name, '@/i18n');
      return { t: value => {
        if (typeof value !== 'string') return value;
        const translated = translations.get(value.trim());
        return translated === undefined ? value : value.replace(value.trim(), translated);
      } };
    },
    h: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    ...variables,
  }, { filename });
  return module.exports;
}

test('translates UI text, visible attributes, conditional labels and literal toasts', () => {
  const collected = new Set();
  const source = `export const view = <section>
    <button aria-label="Copy" title="Copy">Copy</button>
    <input placeholder={searching ? 'Buscar…' : 'Buscar recursos'} />
    <span>{enabled ? 'Activada' : 'Desactivada'}</span>
  </section>;
  toast.success('Guardado localmente'); toast.error('No se pudo guardar');`;
  const output = localizeUi(source, filename, text => collected.add(text));
  const messages = [];
  const dictionary = new Map([
    ['Copy', 'Copiar'], ['Buscar…', 'Search…'], ['Buscar recursos', 'Search assets'],
    ['Activada', 'Enabled'], ['Desactivada', 'Disabled'], ['Guardado localmente', 'Saved locally'], ['No se pudo guardar', 'Could not save'],
  ]);
  const { view } = run(output.code, { searching: true, enabled: false, toast: { success: text => messages.push(text), error: text => messages.push(text) } }, dictionary);
  const [button, input, state] = view.children;
  assert.equal(button.children[0], 'Copiar');
  assert.equal(button.props['aria-label'], 'Copiar');
  assert.equal(button.props.title, 'Copiar');
  assert.equal(input.props.placeholder, 'Search…');
  assert.equal(state.children[0], 'Disabled');
  assert.deepEqual(messages, ['Saved locally', 'Could not save']);
  for (const text of dictionary.keys()) assert.ok(collected.has(text), `Missing collected UI text: ${text}`);
});

test('localizes lookup labels reactively while preserving enum values and non-display metadata', () => {
  const source = `export const options = [
    { label: 'Copy', value: 'Copy', id: 'Copy', url: 'https://example.test/Copy' },
    { label: 'Dark', value: 'dark', command: 'Copy', description: 'Copy' },
  ];`;
  const dictionary = new Map([['Copy', 'Copiar'], ['Dark', 'Oscuro']]);
  const output = localizeUi(source, filename);
  const { options } = run(output.code, {}, dictionary);
  assert.equal(options[0].label, 'Copiar');
  assert.equal(options[1].label, 'Oscuro');
  assert.equal(options[0].value, 'Copy');
  assert.equal(options[0].id, 'Copy');
  assert.equal(options[0].url, 'https://example.test/Copy');
  assert.equal(options[1].value, 'dark');
  assert.equal(options[1].command, 'Copy');
  dictionary.set('Copy', 'Copiar em português');
  assert.equal(options[0].label, 'Copiar em português');
});

test('preserves project/chat/media titles even when they exactly match a translated UI phrase', () => {
  const source = `export const view = <article title={project.name}>
    <p>{message.content}</p><strong>{message.title}</strong><span>{asset.caption}</span>
    <img src={asset.url} alt={asset.name} title={asset.title} />
    <div description={message.description} /><audio src={media.source} />
    <code>{generatedCode}</code><input value={project.name} />
  </article>;
  export const uiCode = command('Copy');`;
  const dictionary = new Map([['Copy', 'Copiar']]);
  const variables = {
    project: { name: 'Copy' }, message: { content: 'Copy', title: 'Copy', description: 'Copy' },
    asset: { caption: 'Copy', name: 'Copy', title: 'Copy', url: 'https://example.test/Copy' },
    media: { source: 'file:///Copy.mp4' }, generatedCode: 'Copy', command: value => value,
  };
  const { view, uiCode } = run(localizeUi(source, filename).code, variables, dictionary);
  assert.equal(view.props.title, 'Copy');
  assert.deepEqual(view.children.slice(0, 3).map(child => child.children[0]), ['Copy', 'Copy', 'Copy']);
  assert.equal(view.children[3].props.alt, 'Copy');
  assert.equal(view.children[3].props.title, 'Copy');
  assert.equal(view.children[3].props.src, 'https://example.test/Copy');
  assert.equal(view.children[4].props.description, 'Copy');
  assert.equal(view.children[5].props.src, 'file:///Copy.mp4');
  assert.equal(view.children[6].children[0], 'Copy');
  assert.equal(view.children[7].props.value, 'Copy');
  assert.equal(uiCode, 'Copy');
});

test('translates literal UI fallback branches without translating a user-supplied fallback value', () => {
  const source = `export const view = <img alt={asset.name || 'Image'} />;`;
  const output = localizeUi(source, filename);
  const dictionary = new Map([['Copy', 'Copiar'], ['Image', 'Imagen']]);
  assert.equal(run(output.code, { asset: { name: 'Copy' } }, dictionary).view.props.alt, 'Copy');
  assert.equal(run(output.code, { asset: { name: '' } }, dictionary).view.props.alt, 'Imagen');
});

test('does not localize project/chat payload fields passed to persistence calls', () => {
  const source = `export const saved = saveProject({ title: 'Copy', description: 'Copy', caption: 'Copy', content: 'Copy' });
    export const queued = enqueueMessage({ title: 'Copy', description: 'Copy', content: 'Copy' });`;
  const dictionary = new Map([['Copy', 'Copiar']]);
  const { saved, queued } = run(localizeUi(source, filename).code, { saveProject: payload => payload, enqueueMessage: payload => payload }, dictionary);
  for (const payload of [saved, queued]) for (const value of Object.values(payload)) assert.equal(value, 'Copy');
  assert.equal(Object.getOwnPropertyDescriptor(saved, 'title').get, undefined);
  assert.equal(Object.getOwnPropertyDescriptor(queued, 'description').get, undefined);
});

test('does not localize literal JSX expressions inside code/pre or change authored text payloads', () => {
  const source = `export const view = <pre><code>{'Copy'}{enabled ? 'Copy' : 'Save'}</code></pre>;`;
  const dictionary = new Map([['Copy', 'Copiar'], ['Save', 'Guardar']]);
  const { view } = run(localizeUi(source, filename).code, { enabled: false }, dictionary);
  assert.deepEqual(view.children[0].children, ['Copy', 'Save']);
});

test('preserves URLs, enum props, technical attributes and non-UI strings without injecting a wrapper', () => {
  const source = `export const view = <a href="https://example.test/Copy" target="_blank" class="Copy" data-state="Copy">
    <input value="Copy" type="text" /><img src="data:image/png;base64,Copy" />
  </a>;
  const values = { value: 'Copy', command: 'Copy', codec: 'h264', path: 'file:///Copy.mp4' };
  invoke('Copy');`;
  const output = localizeUi(source, filename);
  assert.equal(output.code, source);
  assert.equal(output.map, null);
});

test('leaves code/pre contents as authored and preserves meaningful inline JSX spaces', () => {
  const source = `export const code = <pre><code>Copy</code></pre>;
  export const view = <span>Copy <b>file</b> now</span>;`;
  const dictionary = new Map([['Copy', 'Copiar'], ['file', 'archivo'], ['now', 'ahora']]);
  const output = localizeUi(source, filename);
  const { code, view } = run(output.code, {}, dictionary);
  assert.equal(code.children[0].children[0], 'Copy');
  assert.equal(view.children[0], 'Copiar ');
  assert.equal(view.children[1].children[0], 'archivo');
  assert.equal(view.children[2], ' ahora');
});

test('is idempotent, retains valid JSX and never duplicates the translation import or wrapper', () => {
  const source = `export const view = <button title="Copy" placeholder={'Copy'}>Copy</button>; toast.success('Copy');`;
  const once = localizeUi(source, filename);
  const twice = localizeUi(once.code, filename);
  const ast = parse(twice.code);
  const imports = ast.program.body.filter(node => node.type === 'ImportDeclaration' && node.source.value === '@/i18n');
  assert.equal(imports.length, 1);
  let nested = 0;
  traverse(ast, { CallExpression(path) {
    if (path.node.callee.type === 'Identifier' && path.node.callee.name === '__sykaT'
      && path.node.arguments[0]?.type === 'CallExpression' && path.node.arguments[0].callee.name === '__sykaT') nested++;
  } });
  assert.equal(nested, 0);
  assert.equal(twice.code, once.code);
});

test('keeps an existing t call intact when localizing neighboring static UI text', () => {
  const source = `import { t } from '@/i18n'; export const view = <button title={t('Copy')}>Save</button>;`;
  const output = localizeUi(source, filename);
  const ast = parse(output.code);
  let nested = 0;
  traverse(ast, { CallExpression(path) {
    if (path.node.callee.type === 'Identifier' && path.node.callee.name === '__sykaT'
      && path.node.arguments[0]?.type === 'CallExpression' && path.node.arguments[0].callee.name === 't') nested++;
  } });
  assert.equal(nested, 0);
});

test('source maps account for the injected import and retain original source content', () => {
  const source = `const count = 1;\nexport const view = <button>Copy</button>;`;
  const output = localizeUi(source, filename);
  assert.ok(output.map);
  assert.ok(output.map.sourcesContent.includes(source));
  const generatedLines = output.code.split('\n');
  const line = generatedLines.findIndex(text => text.startsWith('export const view')) + 1;
  const mapped = originalPositionFor(new TraceMap(output.map), { line, column: 0 });
  assert.equal(mapped.line, 2);
  assert.equal(mapped.column, 0);
});

test('plugin only transforms authored web TS/TSX and excludes engine, protocol, translations and tests', () => {
  const plugin = uiI18nPlugin();
  const source = '<button>Copy</button>';
  assert.ok(plugin.transform(source, 'F:\\syka\\apps\\web\\src\\components\\toolbar.tsx?direct'));
  for (const id of [
    'F:/syka/apps/desktop/src/main.ts', 'F:/syka/apps/web/src/engine/worker.ts',
    'F:/syka/apps/web/src/dapi/protocol.ts', 'F:/syka/apps/web/src/i18n/index.ts',
    'F:/syka/apps/web/src/components/toolbar.test.tsx', 'F:/syka/apps/web/src/styles.css',
  ]) assert.equal(plugin.transform(source, id), undefined, id);
});
