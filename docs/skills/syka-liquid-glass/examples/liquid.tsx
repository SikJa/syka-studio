/* Liquid Glass nativo de Syka.
 *
 * El vidrio se dibuja con un shader sobre el mismo video de fondo: cada
 * píxel dentro de una tarjeta toma el footage de alrededor (refracción en el
 * borde, desenfoque, tinte y brillo) y fuera de las tarjetas el video pasa
 * igual. Así el vidrio siempre está alineado con lo que tiene detrás y no
 * hace falta otro decodificador de video. Los textos son <text> nativos
 * encima, editables en Propiedades.
 *
 * Basado en las ideas de la skill edicion-liquid de Claudio Conde (capas
 * lente → tinte → borde especular → reflejo, tamaños de tarjeta y reglas de
 * cara libre y bordes limpios). El código es propio.
 */

import { useTicker } from "@diffusionstudio/jsx";
import type { JSX } from "solid-js";

export type Material = "light" | "dark";

export type Tema = {
  font: string;
  ink: string;
  label: string;
  accent: string;
  title: string;
  material: Material;
};

export const TEMA_CLARO: Tema = {
  font: "Inter",
  ink: "#0a2030",
  label: "#152f43",
  accent: "#0066ff",
  title: "#ffffff",
  material: "light",
};

/** Una caja de vidrio: posición y tamaño en px del cuadro, y su ventana de tiempo en segundos de escena. */
export type Vidrio = {
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  in: number;
  out: number;
  material?: Material;
};

/** Una pieza editorial: sus cajas de vidrio y lo que dibuja encima. */
export type Pieza = {
  id: string;
  tipo: string;
  vidrios: Vidrio[];
  in: number;
  out: number;
  /** Cifras: de dónde sale el número. */
  fuente?: string;
  /** Textos con su tope de palabras. */
  textos?: [string, number][];
  contenido: () => JSX.Element;
};

const ENTRADA = 0.45;
const SALIDA = 0.42;

const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const easeIn = (k: number) => k * k * k;
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));

/** 0 → 1 al entrar, 1 mientras se lee, 1 → 0 al salir. */
export function presencia(t: number, entra: number, sale: number): number {
  if (t < entra || t > sale + SALIDA) return 0;
  if (t < entra + ENTRADA) return easeOut(clamp01((t - entra) / ENTRADA));
  if (t > sale) return 1 - easeIn(clamp01((t - sale) / SALIDA));
  return 1;
}

const LIQUID_WGSL = /* wgsl */ `
  @group(1) @binding(0) var<uniform> box0: vec4f;
  @group(1) @binding(1) var<uniform> box1: vec4f;
  @group(1) @binding(2) var<uniform> box2: vec4f;
  @group(1) @binding(3) var<uniform> box3: vec4f;
  @group(1) @binding(4) var<uniform> prog: vec4f;
  @group(1) @binding(5) var<uniform> radius: vec4f;
  @group(1) @binding(6) var<uniform> dark: vec4f;
  @group(1) @binding(7) var<uniform> look: vec4f;

  fn sdBox(p: vec2f, b: vec2f, r: f32) -> f32 {
    let q = abs(p) - b + vec2f(r);
    return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
  }

  fn tap(px: vec2f) -> vec3f {
    return sampleSource(clamp(px / globals.resolution, vec2f(0.001), vec2f(0.999))).rgb;
  }

  // Devuelve rgb del vidrio y en .a cuánto vidrio hay en este píxel (0 fuera).
  fn glass(px: vec2f, box: vec4f, k: f32, rad: f32, isDark: f32) -> vec4f {
    if (k <= 0.001 || box.z <= 0.0) { return vec4f(0.0); }
    let s = mix(0.88, 1.0, k);
    let center = box.xy + box.zw * 0.5 + vec2f(0.0, (1.0 - k) * 26.0);
    let half = box.zw * 0.5 * s;
    let r = min(rad * s, min(half.x, half.y));
    let p = px - center;
    let d = sdBox(p, half, r);
    if (d > 1.5) { return vec4f(0.0); }

    let e = vec2f(1.0, 0.0);
    let n = normalize(vec2f(
      sdBox(p + e.xy, half, r) - sdBox(p - e.xy, half, r),
      sdBox(p + e.yx, half, r) - sdBox(p - e.yx, half, r)) + vec2f(1e-5));

    // Lente: el borde dobla el fondo hacia adentro, el centro magnifica apenas.
    let bezel = min(min(half.x, half.y) * 0.42, look.z);
    let t = clamp(-d / bezel, 0.0, 1.0);
    let bend = pow(1.0 - t, 2.2) * look.y;
    let lensPx = center + p * 0.965 - n * bend;

    // Desenfoque en disco (13 muestras, ángulo dorado).
    var acc = tap(lensPx);
    let blur = look.x;
    for (var i = 1; i < 13; i = i + 1) {
      let fi = f32(i);
      let a = fi * 2.39996;
      let rr = sqrt(fi / 12.0) * blur;
      acc = acc + tap(lensPx + vec2f(cos(a), sin(a)) * rr);
    }
    var col = acc / 13.0;

    // Aberración leve sólo en el bisel.
    let ca = (1.0 - t) * 2.5;
    col.r = mix(col.r, tap(lensPx - n * ca).r, 0.55 * (1.0 - t));
    col.b = mix(col.b, tap(lensPx + n * ca).b, 0.55 * (1.0 - t));

    // Tinte.
    let tint = select(vec3f(1.0), vec3f(0.06, 0.07, 0.09), isDark > 0.5);
    let amount = select(0.20, 0.38, isDark > 0.5);
    col = mix(col, tint, amount);
    col = col + select(vec3f(0.04), vec3f(0.0), isDark > 0.5);

    // Borde especular: línea fina más brillante arriba a la izquierda.
    let light = 0.5 + 0.5 * dot(n, normalize(vec2f(-0.55, -0.85)));
    let rim = (1.0 - smoothstep(0.0, 2.2, abs(d + 1.1))) * (0.35 + 0.65 * light);
    let inner = (1.0 - smoothstep(0.0, 14.0, -d)) * 0.10 * light;
    col = col + vec3f(rim * 0.85 + inner);

    // Reflejo que cruza lento la tarjeta.
    let sweep = fract(globals.time * 0.11) * 3.0 - 1.0;
    let u = (p.x / (half.x * 2.0)) - (p.y / (half.y * 2.0)) * 0.35 + 0.5;
    let band = (1.0 - smoothstep(0.0, 0.10, abs(u - sweep))) * 0.07 * (1.0 - isDark * 0.5);
    col = col + vec3f(band);

    let coverage = clamp(0.5 - d, 0.0, 1.0) * clamp(k * 1.6, 0.0, 1.0);
    return vec4f(clamp(col, vec3f(0.0), vec3f(1.0)), coverage);
  }

  fn shadow(px: vec2f, box: vec4f, k: f32, rad: f32) -> f32 {
    if (k <= 0.001 || box.z <= 0.0) { return 0.0; }
    let s = mix(0.88, 1.0, k);
    let center = box.xy + box.zw * 0.5 + vec2f(0.0, (1.0 - k) * 26.0 + 14.0);
    let half = box.zw * 0.5 * s;
    let d = sdBox(px - center, half, min(rad * s, min(half.x, half.y)));
    return (1.0 - smoothstep(-10.0, 46.0, d)) * 0.20 * k;
  }

  @fragment
  fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
    let px = uv * globals.resolution;
    let base = sampleSource(uv);
    var col = base.rgb;

    let sh = max(max(shadow(px, box0, prog.x, radius.x), shadow(px, box1, prog.y, radius.y)),
                 max(shadow(px, box2, prog.z, radius.z), shadow(px, box3, prog.w, radius.w)));
    col = col * (1.0 - sh);

    let g0 = glass(px, box0, prog.x, radius.x, dark.x);
    col = mix(col, g0.rgb, g0.a);
    let g1 = glass(px, box1, prog.y, radius.y, dark.y);
    col = mix(col, g1.rgb, g1.a);
    let g2 = glass(px, box2, prog.z, radius.z, dark.z);
    col = mix(col, g2.rgb, g2.a);
    let g3 = glass(px, box3, prog.w, radius.w, dark.w);
    col = mix(col, g3.rgb, g3.a);

    return vec4f(col * base.a, base.a);
  }
`;

export type Aspecto = {
  /** Radio del desenfoque, px. */
  blur?: number;
  /** Cuánto dobla el borde, px. */
  refraccion?: number;
  /** Ancho máximo del bisel, px. */
  bisel?: number;
};

/**
 * Un tramo del video de fondo con las cajas de vidrio que caen en él. Hasta
 * cuatro cajas visibles a la vez por tramo.
 */
export function VideoLiquid(props: {
  src: string;
  start: number;
  end: number;
  sourceIn: number;
  width?: number;
  height?: number;
  vidrios: Vidrio[];
  aspecto?: Aspecto;
  id?: string;
  name?: string;
  /** Zoom de cámara: pares [segundo, escala]. Sólo en tramos sin vidrios: el zoom agranda también el vidrio y lo despega de sus textos. */
  zoom?: [number, number][];
}) {
  const { time } = useTicker();
  const uniforms = () => {
    const t = time();
    const vivos = props.vidrios
      .map((v) => ({ v, k: presencia(t, v.in, v.out) }))
      .filter((x) => x.k > 0)
      .slice(0, 4);
    const u: Record<string, number | number[]> = {
      prog: [0, 0, 0, 0],
      radius: [0, 0, 0, 0],
      dark: [0, 0, 0, 0],
      look: [props.aspecto?.blur ?? 7, props.aspecto?.refraccion ?? 22, props.aspecto?.bisel ?? 34, 0],
    };
    for (let i = 0; i < 4; i++) {
      const x = vivos[i];
      u[`box${i}`] = x ? [x.v.x, x.v.y, x.v.w, x.v.h] : [0, 0, 0, 0];
      (u.prog as number[])[i] = x ? x.k : 0;
      (u.radius as number[])[i] = x ? x.v.radius : 0;
      (u.dark as number[])[i] = x?.v.material === "dark" ? 1 : 0;
    }
    return u;
  };
  return (
    <video
      id={props.id}
      name={props.name}
      src={props.src}
      start={props.start}
      end={props.end}
      sourceIn={props.sourceIn}
      width={props.width ?? 1920}
      height={props.height ?? 1080}
    >
      <shaderPaint wgsl={LIQUID_WGSL} uniforms={uniforms()} />
      {props.zoom && (
        <keyframeTrack property="scale">
          {props.zoom.map(([t, v], i) => (
            <keyframe time={t} value={v} easing="easeInOut" />
          ))}
        </keyframeTrack>
      )}
    </video>
  );
}

/* ---------- Piezas ---------- */

type Slot = "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | { x: number; y: number };

const MARGEN = 80;

function ubicar(slot: Slot, w: number, h: number): { x: number; y: number } {
  if (typeof slot === "object") return slot;
  switch (slot) {
    case "left": return { x: MARGEN, y: 540 - h / 2 - 60 };
    case "right": return { x: 1920 - MARGEN - w, y: 540 - h / 2 - 60 };
    case "top-left": return { x: MARGEN, y: 90 };
    case "top-right": return { x: 1920 - MARGEN - w, y: 90 };
    case "bottom-left": return { x: MARGEN, y: 1080 - 72 - h };
    case "bottom-right": return { x: 1920 - MARGEN - w, y: 1080 - 72 - h };
  }
}

/** Opacidad y subida de un contenido que acompaña a su vidrio. */
function useAparece(entra: number, sale: number, retraso = 0.12) {
  const { time } = useTicker();
  const k = () => presencia(time(), entra + retraso, sale);
  return { opacity: () => k(), dy: () => (1 - k()) * 22 };
}

export function stat(o: {
  id: string; in: number; out: number; slot?: Slot; label: string; value: string;
  unit?: string; sub?: string; fuente: string; tema?: Tema;
}): Pieza {
  const tema = o.tema ?? TEMA_CLARO;
  const w = 546, h = 260;
  const { x, y } = ubicar(o.slot ?? "left", w, h);
  return {
    id: o.id, tipo: "stat-card", in: o.in, out: o.out, fuente: o.fuente,
    vidrios: [{ x, y, w, h, radius: 46, in: o.in, out: o.out, material: tema.material }],
    contenido: () => {
      const a = useAparece(o.in, o.out);
      const valueW = o.value.length * 57;
      return (
        <group name={`Cifra · ${o.label}`} start={o.in} end={o.out + 0.5} opacity={a.opacity()} y={a.dy()}>
          <text x={x + 36} y={y + 34} fontFamily={tema.font} fontWeight={600} fontSize={22} letterSpacing={2.4} textCase="upper" color={tema.label}>{o.label}</text>
          <rect x={x + w - 46} y={y + 36} width={14} height={14} cornerRadius={7} fill={tema.accent} />
          <text x={x + 34} y={y + 82} fontFamily={tema.font} fontWeight={800} fontSize={104} letterSpacing={-4} color={tema.ink}>{o.value}</text>
          {o.unit && <text x={x + 30 + valueW} y={y + 140} fontFamily={tema.font} fontWeight={700} fontSize={30} color={tema.ink}>{o.unit}</text>}
          {o.sub && <text x={x + 36} y={y + 206} fontFamily={tema.font} fontWeight={500} fontSize={26} color={tema.label}>{o.sub}</text>}
        </group>
      );
    },
  };
}

export function titular(o: { id: string; in: number; out: number; title: string; pill?: string; tema?: Tema }): Pieza {
  const tema = o.tema ?? TEMA_CLARO;
  const pw = Math.max(320, o.pill ? o.pill.length * 19 + 96 : 0), ph = 54;
  const px = 960 - pw / 2, py = 200;
  return {
    id: o.id, tipo: "headline", in: o.in, out: o.out, textos: [[o.title, 3], [o.pill ?? "", 4]],
    vidrios: o.pill ? [{ x: px, y: py, w: pw, h: ph, radius: 27, in: o.in + 0.25, out: o.out, material: "dark" }] : [],
    contenido: () => {
      const t = useAparece(o.in, o.out, 0);
      const p = useAparece(o.in + 0.25, o.out, 0.1);
      return (
        <group name={`Titular · ${o.title}`} start={o.in} end={o.out + 0.5}>
          <text x={0} width={1920} height={120} textBaseline="middle" textAlign="center" fontFamily={tema.font} fontWeight={800} fontSize={96} letterSpacing={-3} color={tema.title} opacity={t.opacity()} y={70 + t.dy()}>
            {o.title}
            <shadow color="#0a2030" opacity={0.45} blur={28} offsetY={4} />
          </text>
          {o.pill && (
            <text x={px} y={py + p.dy()} width={pw} height={ph} textBaseline="middle" textAlign="center" fontFamily={tema.font} fontWeight={600} fontSize={24} letterSpacing={3.6} textCase="upper" color="#ffffff" opacity={p.opacity()}>{o.pill}</text>
          )}
        </group>
      );
    },
  };
}

export function frase(o: { id: string; in: number; out: number; slot?: Slot; title: string; sub?: string; tema?: Tema }): Pieza {
  const tema = o.tema ?? TEMA_CLARO;
  const w = 546, h = 260;
  const { x, y } = ubicar(o.slot ?? "left", w, h);
  return {
    id: o.id, tipo: "phrase", in: o.in, out: o.out, textos: [[o.title, 8]],
    vidrios: [{ x, y, w, h, radius: 46, in: o.in, out: o.out, material: tema.material }],
    contenido: () => {
      const a = useAparece(o.in, o.out);
      return (
        <group name={`Frase · ${o.title}`} start={o.in} end={o.out + 0.5} opacity={a.opacity()} y={a.dy()}>
          <text x={x + 40} y={y + 40} width={w - 80} height={o.sub ? 130 : 180} textBaseline="middle" fontFamily={tema.font} fontWeight={700} fontSize={50} leading={1.05} letterSpacing={-1.5} color={tema.ink}>{o.title}</text>
          {o.sub && <text x={x + 40} y={y + 190} width={w - 80} fontFamily={tema.font} fontWeight={500} fontSize={24} color={tema.label}>{o.sub}</text>}
        </group>
      );
    },
  };
}

export function pasos(o: {
  id: string; in: number; out: number; slot?: Slot; title: string; items: string[]; reveal?: number[]; tema?: Tema;
}): Pieza {
  const tema = o.tema ?? TEMA_CLARO;
  const w = 546, h = 108 + o.items.length * 78;
  const { x, y } = ubicar(o.slot ?? "left", w, h);
  return {
    id: o.id, tipo: "steps", in: o.in, out: o.out, textos: o.items.map((item) => [item, 4]),
    vidrios: [{ x, y, w, h, radius: 46, in: o.in, out: o.out, material: tema.material }],
    contenido: () => {
      const a = useAparece(o.in, o.out);
      return (
        <group name={`Pasos · ${o.title}`} start={o.in} end={o.out + 0.5} opacity={a.opacity()} y={a.dy()}>
          <text x={x + 40} y={y + 38} fontFamily={tema.font} fontWeight={600} fontSize={22} letterSpacing={2.4} textCase="upper" color={tema.label}>{o.title}</text>
          {o.items.map((item, i) => {
            const at = o.reveal?.[i] ?? o.in + 0.5 + i * 0.35;
            const it = useAparece(at, o.out, 0);
            const iy = y + 96 + i * 78;
            return (
              <group name={`Paso ${i + 1}`} opacity={it.opacity()} y={it.dy() * 0.6}>
                <rect x={x + 40} y={iy} width={46} height={46} cornerRadius={23} fill={tema.accent} />
                <text x={x + 40} y={iy} width={46} height={46} textBaseline="middle" textAlign="center" fontFamily={tema.font} fontWeight={700} fontSize={24} color="#ffffff">{String(i + 1)}</text>
                <text x={x + 106} y={iy + 4} fontFamily={tema.font} fontWeight={600} fontSize={34} letterSpacing={-0.6} color={tema.ink}>{item}</text>
              </group>
            );
          })}
        </group>
      );
    },
  };
}

export function placa(o: { id: string; in: number; out: number; slot?: Slot; name: string; sub?: string; tema?: Tema }): Pieza {
  const tema = o.tema ?? TEMA_CLARO;
  const w = 560, h = 128;
  const { x, y } = ubicar(o.slot ?? "bottom-left", w, h);
  return {
    id: o.id, tipo: "lower-third", in: o.in, out: o.out,
    vidrios: [{ x, y, w, h, radius: 34, in: o.in, out: o.out, material: tema.material }],
    contenido: () => {
      const a = useAparece(o.in, o.out);
      return (
        <group name={`Placa · ${o.name}`} start={o.in} end={o.out + 0.5} opacity={a.opacity()} y={a.dy()}>
          <text x={x + 36} y={y + 22} fontFamily={tema.font} fontWeight={800} fontSize={44} letterSpacing={-1.4} color={tema.ink}>{o.name}</text>
          {o.sub && <text x={x + 38} y={y + 80} fontFamily={tema.font} fontWeight={600} fontSize={20} letterSpacing={3} textCase="upper" color={tema.label}>{o.sub}</text>}
        </group>
      );
    },
  };
}

/* ---------- Reglas duras (el proyecto no se arma si alguna falla) ---------- */

export type Reglas = {
  duracion: number;
  /** Caja de la cara [x, y, ancho, alto]. */
  cara?: [number, number, number, number];
  /** Segundos limpios al principio y al final del video. */
  bordes?: number;
};

export function validar(piezas: Pieza[], reglas: Reglas): void {
  const errores: string[] = [];
  const borde = reglas.bordes ?? 0.35;
  const cajas = piezas.flatMap((p) => p.vidrios.map((v) => ({ p, v })));
  for (const p of piezas) {
    if (p.in < borde) errores.push(`${p.id}: entra a ${p.in}s, antes de ${borde}s.`);
    if (p.out + SALIDA > reglas.duracion - borde) errores.push(`${p.id}: termina de salir a ${(p.out + SALIDA).toFixed(2)}s, después de ${(reglas.duracion - borde).toFixed(2)}s.`);
    if (p.tipo === "stat-card" && !p.fuente?.trim()) errores.push(`${p.id}: la cifra no tiene fuente.`);
    for (const [texto, max] of p.textos ?? []) {
      const n = texto.trim().split(/s+/).filter(Boolean).length;
      if (n > max) errores.push(`${p.id}: «${texto}» tiene ${n} palabras; máximo ${max}.`);
    }
    if (p.out - p.in < 1.1) errores.push(`${p.id}: se ve ${(p.out - p.in).toFixed(2)}s; mínimo 1,1s.`);
  }
  const [fx, fy, fw, fh] = reglas.cara ?? [0, 0, 0, 0];
  for (const { p, v } of cajas) {
    if (reglas.cara && v.x < fx + fw && v.x + v.w > fx && v.y < fy + fh && v.y + v.h > fy) errores.push(`${p.id}: el vidrio pisa la cara.`);
    if (v.x < 0 || v.y < 0 || v.x + v.w > 1920 || v.y + v.h > 1080) errores.push(`${p.id}: el vidrio sale del cuadro.`);
  }
  for (let i = 0; i < cajas.length; i++) {
    for (let j = i + 1; j < cajas.length; j++) {
      const a = cajas[i]!, b = cajas[j]!;
      if (a.p === b.p) continue;
      const tiempo = a.v.in < b.v.out + SALIDA && b.v.in < a.v.out + SALIDA;
      const espacio = a.v.x < b.v.x + b.v.w && a.v.x + a.v.w > b.v.x && a.v.y < b.v.y + b.v.h && a.v.y + a.v.h > b.v.y;
      if (tiempo && espacio) errores.push(`${a.p.id} y ${b.p.id} se superponen.`);
    }
  }
  if (errores.length) throw new Error(`Las piezas no pasan las reglas:\n- ${errores.join("\n- ")}`);
}
