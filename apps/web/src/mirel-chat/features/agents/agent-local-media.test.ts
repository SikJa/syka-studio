import {describe, expect, it} from 'vitest';
import {localFileTarget, projectImageSource, projectArtifactKind, projectArtifactSource} from './agent-local-media';

describe('local media in assistant replies', () => {
  it('accepts project images in Windows and Mac paths, with spaces', () => {
    expect(projectImageSource('f:/Proyecto/03 Assets/portada.png', 'F:\\Proyecto')).toBe('03 Assets/portada.png');
    expect(projectImageSource('/Users/example/Proyecto/03 Assets/portada.jpg', '/Users/example/Proyecto')).toBe('03 Assets/portada.jpg');
    expect(localFileTarget('/Users/example/Proyecto/portada.svg')).toBe(true);
  });
  it('rejects sibling projects, traversal, hidden data, URLs, SVG and large-file schemes', () => {
    for (const path of ['F:/Proyecto-ajeno/portada.png', 'F:/Proyecto/../secret.png', 'F:/Proyecto/.syka/private.png', 'https://example.com/portada.png', 'F:/Proyecto/portada.svg', 'F:/Proyecto/portada.png?x=1']) expect(projectImageSource(path, 'F:/Proyecto')).toBeNull();
    expect(projectImageSource('/Users/example/proyecto/portada.png', '/Users/example/Proyecto')).toBeNull();
    expect(localFileTarget('javascript:alert(1)')).toBe(false);
    expect(localFileTarget('//host/share/portada.png')).toBe(false);
  });
  it('allows readable project documents and editable covers with portable path containment', () => {
    expect(projectArtifactSource('f:/Proyecto/content-drafts/v1/borradores.md', 'F:\\Proyecto')).toBe('content-drafts/v1/borradores.md');
    expect(projectArtifactSource('/Users/example/Proyecto/Título largo.txt', '/Users/example/Proyecto')).toBe('Título largo.txt');
    expect(projectArtifactKind('F:/Proyecto/portada.svg')).toBe('image');
    expect(projectArtifactKind('F:/Proyecto/borradores.md')).toBe('document');
  });
  it('does not broaden document preview access to hidden files, siblings or URL schemes', () => {
    for (const path of ['F:/Proyecto-ajeno/borradores.md', 'F:/Proyecto/../secret.md', 'F:/Proyecto/.syka/context.md', 'https://example.com/texto.md', 'F:/Proyecto/texto.md?x=1', 'F:/Proyecto/secret.json']) expect(projectArtifactSource(path, 'F:/Proyecto')).toBeNull();
    expect(projectArtifactSource('/Users/example/proyecto/texto.md', '/Users/example/Proyecto')).toBeNull();
  });
});
