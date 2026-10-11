/* MPL-2.0. Compile-time UI localization; never edits project or chat content. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
const types = require('@babel/types');
const visibleAttributes = new Set(['label', 'title', 'description', 'placeholder', 'aria-label', 'alt', 'heading', 'tooltip', 'emptyText']);
const uiTables = /(?:options|items|entries|tabs|pages|menu|sections|settings|labels|commands|presets|actions|schemes|purposes|variants|modes|types|navigation)$/i;
const human = value => /[\p{L}]/u.test(value) && !/^(https?:|file:|data:)/.test(value);
const phrase = value => value.replace(/\s+/g, ' ').trim();

export function localizeUi(code, filename, collect = () => {}) {
  let used = false;
  const wrap = expression => {
    used = true;
    return types.callExpression(types.identifier('__sykaT'), [expression]);
  };
  const collectLiteral = path => {
    if (types.isStringLiteral(path.node) && human(path.node.value)) collect(phrase(path.node.value));
  };
  const translateLiteralBranches = expression => {
    if (types.isStringLiteral(expression) && human(expression.value)) { collect(phrase(expression.value)); return wrap(expression); }
    if (types.isConditionalExpression(expression)) {
      expression.consequent = translateLiteralBranches(expression.consequent);
      expression.alternate = translateLiteralBranches(expression.alternate);
    } else if (types.isLogicalExpression(expression)) expression.right = translateLiteralBranches(expression.right);
    return expression;
  };
  const result = transformSync(code, {
    filename, configFile: false, babelrc: false, sourceMaps: true,
    parserOpts: { plugins: ['typescript', 'jsx'] },
    plugins: [() => ({ visitor: {
      Program: { exit(path) { if (used && !path.scope.hasBinding('__sykaT')) path.node.body.unshift(types.importDeclaration([
        types.importSpecifier(types.identifier('__sykaT'), types.identifier('t')),
      ], types.stringLiteral('@/i18n'))); } },
      JSXElement(path) {
        const element = path.node.openingElement;
        if (types.isJSXIdentifier(element.name) && ['code', 'pre', 'script', 'style'].includes(element.name.name)
          || element.attributes.some(attr => types.isJSXAttribute(attr) && types.isJSXIdentifier(attr.name, { name: 'translate' }) && types.isStringLiteral(attr.value, { value: 'no' }))) path.skip();
      },
      JSXText(path) {
        // Code samples are data, even if a word matches an interface label.
        if (path.findParent(parent => types.isJSXElement(parent.node) && types.isJSXIdentifier(parent.node.openingElement.name)
          && ['code', 'pre', 'script', 'style'].includes(parent.node.openingElement.name.name))) return;
        const text = phrase(path.node.value);
        if (!human(text)) return;
        collect(text);
        const raw = path.node.value;
        const leading = /^\s/.test(raw) && !/^\s*\n/.test(raw) ? ' ' : '';
        const trailing = /\s$/.test(raw) && !/\n\s*$/.test(raw) ? ' ' : '';
        path.replaceWith(types.jsxExpressionContainer(wrap(types.stringLiteral(leading + text + trailing)))); path.skip();
      },
      JSXAttribute(path) {
        if (!types.isJSXIdentifier(path.node.name) || !visibleAttributes.has(path.node.name.name)) return;
        const value = path.node.value;
        if (types.isStringLiteral(value) && human(value.value)) {
          collect(phrase(value.value)); path.node.value = types.jsxExpressionContainer(wrap(value)); path.skip();
        } else if (types.isJSXExpressionContainer(value) && types.isExpression(value.expression)) {
          value.expression = translateLiteralBranches(value.expression);
        }
      },
      JSXExpressionContainer(path) {
        if (types.isJSXAttribute(path.parent)) return;
        const expression = path.node.expression;
        if (types.isStringLiteral(expression) && human(expression.value)) {
          collect(phrase(expression.value)); path.node.expression = wrap(expression); path.skip();
        } else if (types.isConditionalExpression(expression) || types.isLogicalExpression(expression)) {
          path.node.expression = translateLiteralBranches(expression);
        }
      },
      // UI-owned lookup labels stay reactive even when the table is declared
      // once at module scope. Stored enum values and user data are untouched.
      ObjectProperty(path) {
        if (types.isIdentifier(path.node.key) && visibleAttributes.has(path.node.key.name) && types.isStringLiteral(path.node.value) && human(path.node.value.value)) {
          collectLiteral(path.get('value'));
          const table = path.findParent(parent => types.isVariableDeclarator(parent.node));
          // A literal in a save/send payload is still project/chat data.
          if (!table || !types.isIdentifier(table.node.id) || !uiTables.test(table.node.id.name)
            || path.findParent(parent => types.isCallExpression(parent.node))) return;
          path.replaceWith(types.objectMethod('get', path.node.key, [], types.blockStatement([types.returnStatement(wrap(path.node.value))]))); path.skip();
        }
      },
      CallExpression(path) {
        if (!types.isMemberExpression(path.node.callee) || !types.isIdentifier(path.node.callee.object, { name: 'toast' })) return;
        const first = path.node.arguments[0];
        if (types.isStringLiteral(first) && human(first.value)) {
          collect(phrase(first.value)); path.node.arguments[0] = wrap(first);
        }
      },
    } })],
  });
  if (!used) return { code, map: null };
  return { code: result.code, map: result.map };
}

export function uiI18nPlugin() {
  return { name: 'syka-ui-i18n', enforce: 'pre', transform(code, id) {
    const path = id.replaceAll('\\', '/').split('?')[0];
    if (!path.includes('/apps/web/src/') || !/\.tsx?$/.test(path) || /\/i18n\/|\.test\.|\/engine\/|\/dapi\//.test(path)) return;
    return localizeUi(code, path);
  } };
}
