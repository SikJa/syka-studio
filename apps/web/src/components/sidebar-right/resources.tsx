import {
  Text,
  SolidPaint,
  Animation,
  Effect,
  Shadow,
  Stroke,
} from '@diffusionstudio/reconciler';
import {
  getActiveEntity,
  getParentEntity,
  isSequence,
  isShape,
  isText,
  isCaption,
  isGroup,
  isScene,
  isClipPath,
  Computed,
  Size,
  store,
  getWebFonts,
  FontStyle,
  TextStyle,
} from '@diffusionstudio/runtime';
import type { Entity, World } from 'koota';
import { getDocumentEditor } from '@/engine/editor';
import { getEditHistory } from '@/engine/history';
import { EFFECT_OPTIONS } from './inspector/effect-types';
import { ANIMATION_GROUPS } from './inspector/animation-types';
import { TRANSITION_OPTIONS } from './inspector/transition-types';
import { CAPTION_PRESET_OPTIONS } from './inspector/caption-types';
export type ResourceKind =
  'text' | 'font' | 'caption' | 'effect' | 'animation' | 'transition' | 'shadow' | 'stroke';
export type ResourceTextStyle = {
  fontFamily: string;
  fontWeight: number;
  fontStyle?: 'normal' | 'italic';
  fontSize: number;
  color: string;
  entrance: number;
  exit: number;
};
export type EditorResource = {
  id: string;
  label: string;
  kind: ResourceKind;
  value: string;
  preview: string;
  textOnly?: boolean;
  description?: string;
  textStyle?: ResourceTextStyle;
};
const CAPTION_DESCRIPTIONS: Record<string, string> = {
  classic: 'Lectura limpia, centrada, con sombra para separar del fondo.',
  cascade: 'Entrada de palabras en cascada. Ideal para ritmo y énfasis.',
  spotlight: 'Destaca la palabra activa con color, siguiendo el audio.',
  whisper: 'Tipografía discreta para relatos pausados.',
  paper: 'Composición editorial con contraste sobre una base clara.',
  guinea: 'Énfasis expresivo con una paleta de tres colores.',
  stark: 'Texto contundente, con una jerarquía simple.',
  'bridgeclip-subtle': 'Montserrat ExtraBold. Frases cortas y énfasis celeste.',
  'bridgeclip-editorial': 'Instrument Serif en cursiva. Un tono narrativo y cálido.',
  'bridgeclip-boxed': 'Archivo Black. Fondo oscuro y énfasis amarillo.',
  'bridgeclip-spotlight': 'Poppins Black. Palabra activa sobre una píldora violeta.',
};
export const EDITOR_RESOURCES: EditorResource[] = [
  ...CAPTION_PRESET_OPTIONS.map(o => ({
    id: 'caption-' + o.name, label: o.label, kind: 'caption' as const,
    value: o.name, preview: o.name,
    description: CAPTION_DESCRIPTIONS[o.name],
  })),
  {
    id: 'text-title',
    label: 'Título simple',
    kind: 'text',
    value: 'Título',
    preview: 'title',
    description: 'Inter Semibold. Entrada suave, lectura y salida independiente.',
    textStyle: { fontFamily: 'Inter', fontWeight: 600, fontSize: 112, color: '#f1eee6', entrance: .48, exit: .32 },
  },
  {
    id: 'text-callout',
    label: 'Frase destacada',
    kind: 'text',
    value: 'Una idea.\nUn nuevo ritmo.',
    preview: 'callout',
    description: 'Figtree Medium. Dos líneas con una jerarquía clara.',
    textStyle: { fontFamily: 'Figtree', fontWeight: 500, fontSize: 88, color: '#f1eee6', entrance: .5, exit: .35 },
  },
  {
    id: 'text-editorial', label: 'Editorial', kind: 'text',
    value: 'Menos ruido.\nMás sentido.', preview: 'editorial',
    description: 'Instrument Serif en cursiva. Una frase editorial con aire para leer.',
    textStyle: { fontFamily: 'Instrument Serif', fontWeight: 400, fontStyle: 'italic', fontSize: 112, color: '#f1eee6', entrance: .6, exit: .4 },
  },
  {
    id: 'text-impact', label: 'Impacto', kind: 'text', value: 'HACÉ\nESPACIO.', preview: 'impact',
    description: 'Archivo Black. Un titular compacto y contundente.',
    textStyle: { fontFamily: 'Archivo Black', fontWeight: 400, fontSize: 112, color: '#f1eee6', entrance: .45, exit: .3 },
  },
  ...EFFECT_OPTIONS.map((o) => ({
    id: 'effect-' + o.name,
    label: o.label,
    kind: 'effect' as const,
    value: o.name,
    preview: o.name,
  })),
  ...ANIMATION_GROUPS.filter((g) => g.kind !== 'audio').flatMap((g) =>
    g.options.map((o) => ({
      id: 'animation-' + o.name,
      get label() { return o.label; },
      kind: 'animation' as const,
      value: o.name,
      preview: o.name,
      textOnly: g.kind === 'text',
    })),
  ),
  ...TRANSITION_OPTIONS.map((o) => ({
    id: 'transition-' + o.name,
    label: o.label,
    kind: 'transition' as const,
    value: o.name,
    preview: o.name,
  })),
  {
    id: 'style-shadow',
    label: 'Sombra suave',
    kind: 'shadow',
    value: 'shadow',
    preview: 'shadow',
  },
  {
    id: 'style-stroke',
    label: 'Borde claro',
    kind: 'stroke',
    value: 'stroke',
    preview: 'stroke',
  },
];
export function getEditorResources(): EditorResource[] {
  return [...EDITOR_RESOURCES, ...getWebFonts().map(f => ({
    id: 'font-' + f.family, label: f.family, kind: 'font' as const, value: f.family, preview: 'font',
    description: `${f.origin === 'imported' ? 'Importada por vos. Verificá su licencia para el uso previsto.' : 'Incluida en Syka; disponible sin conexión.'} Pesos: ${[...new Set(f.variants.map(v => v.weight))].join(', ')}.${f.missingSpanish?.length ? ' No incluye: ' + f.missingSpanish.join(' ') + '.' : ''}`,
  }))];
}
export function resourceDisabledReason(
  resource: EditorResource,
  target: Entity | undefined,
): string | undefined {
  if (resource.kind === 'text') return;
  if (resource.kind === 'caption') return target?.isAlive() && isCaption(target) ? undefined : 'Seleccioná subtítulos existentes, importá un SRT/VTT/JSON o generá desde el audio de la escena.';
  if (resource.kind === 'font') return target?.isAlive() && (isText(target) || isCaption(target)) ? undefined : 'Seleccioná un texto o subtítulos para cambiar su fuente.';
  if (!target?.isAlive()) return 'Seleccioná un elemento de la timeline.';
  if (resource.kind === 'transition')
    return isShape(target) &&
      !!getParentEntity(target) &&
      isSequence(getParentEntity(target)!)
      ? undefined
      : 'La transición necesita un clip dentro de una secuencia. Se aplica en el corte hacia el siguiente clip.';
  if (resource.kind === 'animation')
    return (isShape(target) ||
      isText(target) ||
      isCaption(target) ||
      isGroup(target) ||
      isClipPath(target)) &&
      (!resource.textOnly || isText(target) || isCaption(target))
      ? undefined
      : 'Esta animación no se aplica a la selección actual.';
  if (resource.kind === 'shadow' || resource.kind === 'stroke')
    return isShape(target) ||
      isText(target) ||
      isScene(target) ||
      (resource.kind === 'stroke' && isCaption(target))
      ? undefined
      : 'Este estilo no se aplica a la selección actual.';
  return isShape(target) ||
    isText(target) ||
    isCaption(target) ||
    isScene(target)
    ? undefined
    : 'Seleccioná un elemento visual para aplicar el efecto.';
}
export function applyEditorResource(
  world: World,
  resource: EditorResource,
  target?: Entity | Entity[],
  start?: number,
): void {
  const targets = Array.isArray(target) ? target : [target];
  if (resource.kind !== 'text' && !targets.length)
    throw Error('Seleccioná un elemento de la timeline.');
  for (const entity of targets) {
    const reason = resourceDisabledReason(resource, entity);
    if (reason) throw Error(reason);
  }
  const editor = getDocumentEditor(world);
  getEditHistory(world).command(() => {
    if (resource.kind === 'text') {
      const parent = getActiveEntity(world);
      if (!parent) throw Error('Abrí una escena antes de agregar texto.');
      const size = parent.get(Size);
      const at =
        start ?? store(world, Computed).localTimeInSeconds[parent.id()] ?? 0;
      const style = resource.textStyle;
      const [entity] = editor.insertElement(parent, () => (
        <Text
          name={resource.label}
          x={(size?.width ?? 1920) * 0.15}
          y={(size?.height ?? 1080) * 0.45}
          width={(size?.width ?? 1920) * 0.7}
          height={(size?.height ?? 1080) * 0.4}
          fontFamily={style?.fontFamily ?? 'Inter'}
          fontWeight={style?.fontWeight ?? 400}
          fontStyle={style?.fontStyle ?? 'normal'}
          fontSize={(style?.fontSize ?? 64) * (size?.width ?? 1920) / 1920}
          start={at}
          end={at + 4}
        >
          {resource.value}
          <SolidPaint color={style?.color ?? '#ffffff'} />
          {style && <Animation type="softRise" phase="in" duration={style.entrance} />}
          {style && <Animation type="softRise" phase="out" duration={style.exit} />}
        </Text>
      ));
      if (!entity) throw Error('No se pudo insertar el texto.');
      editor.select(entity);
      return;
    }
    for (const target of targets) {
      if (!target) continue;
      const insert = (element: () => unknown) => {
        if (!editor.insertElement(target, element).length)
          throw Error('No se pudo insertar el preset en este elemento.');
      };
      switch (resource.kind) {
        case 'caption':
          editor.editProperty(target, 'colors', false);
          editor.editProperty(target, 'preset', resource.value === 'classic' ? false : resource.value);
          break;
        case 'font':
          editor.editProperty(target, 'fontFamily', resource.value);
          {
            const text = target.get(TextStyle);
            const family = getWebFonts().find(f => f.family === resource.value);
            const matching = family?.variants.filter(v => (v.style ?? FontStyle.NORMAL) === (text?.fontStyle ?? FontStyle.NORMAL));
            const variants = matching?.length ? matching : family?.variants;
            const variant = variants?.toSorted((a, b) => Math.abs(Number(a.weight) - Number(text?.fontWeight ?? 400)) - Math.abs(Number(b.weight) - Number(text?.fontWeight ?? 400)))[0];
            if (variant) {
              editor.editProperty(target, 'fontWeight', Number(variant.weight));
              editor.editProperty(target, 'fontStyle', variant.style === FontStyle.ITALIC ? 'italic' : false);
            }
          }
          break;
        case 'effect': {
          const option = EFFECT_OPTIONS.find((o) => o.name === resource.value)!;
          insert(() => <Effect type={option.name} value={option.value} />);
          break;
        }
        case 'animation': {
          const option = ANIMATION_GROUPS.flatMap((g) => g.options).find(
            (o) => o.name === resource.value,
          )!;
          insert(() => <Animation type={option.name} />);
          break;
        }
        case 'transition': {
          const option = TRANSITION_OPTIONS.find(
            (o) => o.name === resource.value,
          )!;
          editor.editProperty(target, 'transition', {
            type: option.name,
            duration: 0.5,
          });
          break;
        }
        case 'shadow':
          insert(() => (
            <Shadow color="#000000" opacity={0.25} blur={4} offsetY={4} />
          ));
          break;
        case 'stroke':
          insert(() => <Stroke color="#ffffff" />);
          break;
      }
    }
  });
}
