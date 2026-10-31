import { expect, it } from 'vitest';
import { transformAsync } from '@babel/core';
import { transform } from 'esbuild';
import { canonicalizeTagsPlugin } from '../src/source';

it('routes variable, member and function DOM refs through the host backing element', async () => {
  const source = `export default function fixture() {
    let host; const refs = { icon: null }; let callbackValue; let calls = 0;
    const callback = value => { callbackValue = value; calls++; };
    const nodes = [<div ref={host}/>, <svg ref={refs.icon}/>, <span ref={callback}/>];
    return {host, icon: refs.icon, callbackValue, calls, nodes};
  }`;
  const jsx = await transformAsync(source, {
    filename: 'fixture.jsx', babelrc: false, configFile: false,
    plugins: [canonicalizeTagsPlugin],
    presets: [['babel-preset-solid', { generate: 'universal', moduleName: '@diffusionstudio/jsx' }]],
  });
  const result = await transform(jsx!.code!, { format: 'cjs' });
  const module = { exports: {} as { default: () => Record<string, any> } };
  const hostRuntime = {
    createElement: (tag: string) => ({ tag, element: { tagName: tag.toUpperCase() } }),
    use: (ref: (target: unknown) => void, node: { element: unknown }) => ref(node.element),
  };
  new Function('module', 'exports', 'require', result.code)(module, module.exports, () => hostRuntime);
  const values = module.exports.default();
  expect(values.host).toBe(values.nodes[0].element);
  expect(values.icon).toBe(values.nodes[1].element);
  expect(values.callbackValue).toBe(values.nodes[2].element);
  expect(values.calls).toBe(1);
}, 15000);
