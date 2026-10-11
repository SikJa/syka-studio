/** @jsxImportSource react */
import { Fragment, type ReactNode } from "react";
import { PlatformIcon } from "../../shared/social-platform-selector.js";
import {webPlatform,splitWebDraft,type WebPlatform} from '@/lib/web-links';
import { localFileTarget, projectArtifactKind } from './agent-local-media';
import { AgentLocalArtifact } from './agent-local-artifact';

export type AgentRichTextBlock =
  | { type: "heading"; level: 1 | 2 | 3 | 4; text: string }
  | { type: "paragraph"; text: string }
  | { type: "links"; urls: string[] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string }
  | { type: "code"; language?: string; text: string }
  | { type: "rule" }
  | { type: "table"; headers: string[]; rows: string[][] };

const tableDivider = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/u;
const heading = /^(#{1,4})\s+(.+)$/u;
const unordered = /^\s*[-*+]\s+(.+)$/u;
const ordered = /^\s*\d+[.)]\s+(.+)$/u;
const rule = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/u;

export function parseAgentMarkdown(value: string): AgentRichTextBlock[] {
  const lines = normalizeAgentMarkdown(value).split("\n");
  const blocks: AgentRichTextBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const current = lines[index] ?? "";
    if (!current.trim()) { index += 1; continue; }

    if (current.trimStart().startsWith("```")) {
      const language = current.trim().slice(3).trim() || undefined;
      const content: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]?.trimStart().startsWith("```")) {
        content.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", ...(language ? { language } : {}), text: content.join("\n") });
      continue;
    }

    const standaloneUrl = standaloneHttpUrl(current);
    if (standaloneUrl) {
      const urls = [standaloneUrl];
      index += 1;
      while (index < lines.length) {
        const nextUrl = standaloneHttpUrl(lines[index] ?? "");
        if (!nextUrl) break;
        urls.push(nextUrl);
        index += 1;
      }
      blocks.push({ type: "links", urls });
      continue;
    }

    const headingMatch = current.match(heading);
    if (headingMatch) {
      blocks.push({ type: "heading", level: headingMatch[1]!.length as 1 | 2 | 3 | 4, text: headingMatch[2]!.trim() });
      index += 1;
      continue;
    }
    if (rule.test(current)) { blocks.push({ type: "rule" }); index += 1; continue; }
    if (current.trimStart().startsWith(">")) {
      const quoted: string[] = [];
      while (index < lines.length && lines[index]?.trimStart().startsWith(">")) {
        quoted.push((lines[index] ?? "").trimStart().replace(/^>\s?/u, ""));
        index += 1;
      }
      blocks.push({ type: "quote", text: quoted.join(" ") });
      continue;
    }
    if (index + 1 < lines.length && current.includes("|") && tableDivider.test(lines[index + 1] ?? "")) {
      const headers = tableCells(current);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && (lines[index] ?? "").includes("|") && (lines[index] ?? "").trim()) {
        rows.push(tableCells(lines[index] ?? ""));
        index += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    const unorderedMatch = current.match(unordered);
    const orderedMatch = current.match(ordered);
    if (unorderedMatch || orderedMatch) {
      const isOrdered = Boolean(orderedMatch);
      const items: string[] = [];
      while (index < lines.length) {
        const match = (lines[index] ?? "").match(isOrdered ? ordered : unordered);
        if (!match) break;
        items.push(match[1]!.trim());
        index += 1;
      }
      blocks.push({ type: "list", ordered: isOrdered, items });
      continue;
    }

    const paragraph: string[] = [current.trim()];
    index += 1;
    while (index < lines.length && lines[index]?.trim()) {
      const next = lines[index] ?? "";
      if (next.trimStart().startsWith("```") || standaloneHttpUrl(next) || heading.test(next) || rule.test(next) || next.trimStart().startsWith(">") || unordered.test(next) || ordered.test(next) || (index + 1 < lines.length && next.includes("|") && tableDivider.test(lines[index + 1] ?? ""))) break;
      paragraph.push(next.trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }
  return blocks;
}

export function normalizeAgentMarkdown(value: string): string {
  return value
    .replace(/\r\n?/gu, "\n")
    // Prose recovery must not rewrite paths (for example "Project - 2026")
    // inside links or inline code into list items.
    .split(/(```[\s\S]*?```|\[[^\]\n]+\]\((?:<[^>\n]+>|[^\s)]+)\)|`[^`\n]+`)/gu)
    .map((segment) => segment.startsWith("`") || /^\[[^\]\n]+\]\(/u.test(segment) ? segment : segment
      .replace(/\s+---\s+(?=#{2,4}\s)/gu, "\n\n---\n\n")
      .replace(/\s+(?=#{2,4}\s)/gu, "\n\n")
      .replace(/\|\s+\|(?=\s*(?:[:\-*`A-Za-zÁÉÍÓÚÑáéíóúñ0-9]))/gu, "|\n|")
      .replace(/^(#{1,4}\s+[^|\n]+?)\s+(\|[^\n]+)$/gmu, "$1\n$2")
      .replace(/:\s+(?=-\s+(?:\*\*|__|`|[A-Za-zÁÉÍÓÚÑáéíóúñ0-9]))/gu, ":\n\n")
      .replace(/[\t ]+(?=-\s+(?:\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|(?:IMG[_-]?\d+|[^\s:]+\.(?:mov|mp4|m4v|webm|mkv|wav|mp3|aac))\b))/giu, "\n")
      // Preserve Markdown headings such as "## 1. Título" while recovering
      // numbered lists flattened after ordinary prose by Hermes.
      .replace(/([^#\n])[\t ]+(?=\d+[.)]\s+(?:\*\*|__|`|[A-ZÁÉÍÓÚÑ]))/gu, "$1\n")
      .replace(/((?:frames?|ms|segundos?|s)(?:\s+de\s+imagen)?)\s+(?=(?:Son|El resultado|Los originales|Ahora|Después|Antes|En resumen|La preview|¿))/gu, "$1\n\n")
      .replace(/([.!?`)])\s+(?=¿[^?\n]{1,80}\?\s*$)/gmu, "$1\n\n")
      .replace(/:\s*-\s+(?=[A-ZÁÉÍÓÚÑ0-9])/gu, ":\n- ")
      .replace(/\s+-\s+(?=(?:No\s|[A-ZÁÉÍÓÚÑ0-9][^\n]{2,}))/gu, "\n- "))
    .join("");
}

export function AgentRichText({ body, previewFiles = true }: { body: string; previewFiles?: boolean }) {
  return <div className="agent-rich-text">{parseAgentMarkdown(body).map((block, index) => renderAgentBlock(block, index, previewFiles))}</div>;
}

export function AgentUserText({body}:{body:string}) {
  const {text,links}=splitWebDraft(body);
  return <>{text.trim()?<AgentRichText body={text}/>:null}{links.length?<div className="syka-sent-web-links">{links.map(href=><AgentExternalUrl key={href} href={href} compact/>)}</div>:null}</>;
}

export function renderAgentBlock(block: AgentRichTextBlock, index: number, previewFiles = true): ReactNode {
  const key = `${block.type}-${index}`;
  if (block.type === "heading") {
    const content = inlineMarkdown(block.text);
    if (block.level === 1) return <h2 key={key}>{content}</h2>;
    if (block.level === 2) return <h3 key={key}>{content}</h3>;
    return <h4 key={key}>{content}</h4>;
  }
  if (block.type === "paragraph" && previewFiles) return <Fragment key={key}>{renderArtifactParagraph(block.text)}</Fragment>;
  if (block.type === "paragraph") return <p key={key}>{inlineMarkdown(block.text)}</p>;
  if (block.type === "links") return <div className="agent-rich-links" key={key}>{block.urls.map((url) => <AgentExternalUrl key={url} href={url} standalone />)}</div>;
  if (block.type === "quote") return <blockquote key={key}>{inlineMarkdown(block.text)}</blockquote>;
  if (block.type === "rule") return <hr key={key} />;
  if (block.type === "code") return <pre key={key} data-language={block.language}><code>{block.text}</code></pre>;
  if (block.type === "list") {
    const Tag = block.ordered ? "ol" : "ul";
    if (previewFiles) {
      const nodes: ReactNode[] = [], group: { text: string; index: number }[] = [];
      const flush = () => { if (group.length) { nodes.push(<Tag key={`list-${group[0]!.index}`} {...(block.ordered ? { start: group[0]!.index + 1 } : {})}>{group.map(item => <li key={item.index}>{inlineMarkdown(item.text)}</li>)}</Tag>); group.length = 0; } };
      block.items.forEach((text, itemIndex) => {
        const artifact = /!?\[[^\]\n]*\]\((<[^>\n]+>|[^\s)]+)\)/gu;
        if ([...text.matchAll(artifact)].some(match => { const path = match[1]!.replace(/^<|>$/gu, ''); return localFileTarget(path) && projectArtifactKind(path); })) {
          flush(); nodes.push(<Fragment key={`artifact-list-${itemIndex}`}>{renderArtifactParagraph(text)}</Fragment>);
        } else group.push({ text, index: itemIndex });
      });
      flush(); return <Fragment key={key}>{nodes}</Fragment>;
    }
    return <Tag key={key}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item)}</li>)}</Tag>;
  }
  return <div className="agent-rich-text__table-scroll" key={key} role="region" aria-label="Tabla de la respuesta" tabIndex={0}><table><thead><tr>{block.headers.map((cell, cellIndex) => <th scope="col" key={cellIndex}>{inlineMarkdown(cell)}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{block.headers.map((_, cellIndex) => <td key={cellIndex}>{inlineMarkdown(row[cellIndex] ?? "")}</td>)}</tr>)}</tbody></table></div>;
}

/** Keep block cards outside paragraphs, including ordinary PNG links without ![]. */
function renderArtifactParagraph(value: string): ReactNode[] {
  const result: ReactNode[] = [];
  const token = /!?\[([^\]\n]*)\]\((<[^>\n]+>|[^\s)]+)\)/gu;
  const seen = new Set<string>();
  const hasRaster = /!?\[[^\]\n]*\]\((?:<[^>\n]+\.(?:png|jpe?g|webp|gif)>|[^\s)]+\.(?:png|jpe?g|webp|gif))\)/iu.test(value);
  let cursor = 0;
  for (const match of value.matchAll(token)) {
    const target = match[2]!.replace(/^<|>$/gu, '');
    if (!localFileTarget(target) || !projectArtifactKind(target)) continue;
    if (hasRaster && /\.svg$/iu.test(target)) continue;
    const start = match.index!;
    const before = value.slice(cursor, start).replace(/^\s*[·|]\s*|\s*[·|]\s*$/gu, '').trim();
    if (before) result.push(<p key={`text-${start}`}>{inlineMarkdown(before)}</p>);
    const normalized = target.replaceAll('\\', '/').toLowerCase();
    if (!seen.has(normalized)) result.push(<AgentLocalArtifact key={`artifact-${start}`} target={target} label={match[1] || target.split(/[\\/]/).at(-1) || 'Archivo del proyecto'}/>);
    seen.add(normalized); cursor = start + match[0].length;
  }
  const tail = value.slice(cursor).replace(/^\s*[·|]\s*/u, '').trim();
  if (tail) result.push(<p key="tail">{inlineMarkdown(tail)}</p>);
  return result;
}

function inlineMarkdown(value: string): ReactNode[] {
  const token = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|!?\[[^\]\n]*\]\((?:<[^>\n]+>|[^\s)]+)\)|https?:\/\/[^\s<]+|\*[^*\n]+\*|_[^_\n]+_)/gu;
  const result: ReactNode[] = [];
  let cursor = 0;
  for (const match of value.matchAll(token)) {
    const start = match.index ?? 0;
    if (start > cursor) result.push(value.slice(cursor, start));
    const part = match[0];
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) result.push(<strong key={`${start}-strong`}>{inlineMarkdown(part.slice(2, -2))}</strong>);
    else if (part.startsWith("`") && part.endsWith("`")) result.push(<code key={`${start}-code`}>{part.slice(1, -1)}</code>);
    else if (part.startsWith("![") || part.startsWith("[")) {
      const link = part.match(/^!?\[([^\]]*)\]\((<[^>\n]+>|[^)]+)\)$/u);
      const target = (link?.[2] ?? '').replace(/^<|>$/gu, '');
      if (localFileTarget(target)) {
        result.push(<AgentLocalArtifact inline key={`${start}-file`} target={target} label={link?.[1] || 'Archivo del proyecto'}/>);
        cursor = start + part.length;
        continue;
      }
      const href = safeHref(target);
      result.push(href ? <a key={`${start}-link`} href={href} target={/^\/(reels|historias|analiticas)\?/.test(href) ? undefined : "_blank"} rel="noreferrer"><AgentLinkPlatform href={href} />{link?.[1]}</a> : <Fragment key={`${start}-text`}>{link?.[1] ?? part}</Fragment>);
    } else if (/^https?:\/\//iu.test(part)) {
      const { href, tail } = splitRawUrl(part);
      result.push(<AgentExternalUrl key={`${start}-url`} href={href} />);
      if (tail) result.push(<Fragment key={`${start}-url-tail`}>{tail}</Fragment>);
    } else result.push(<em key={`${start}-em`}>{part.slice(1, -1)}</em>);
    cursor = start + part.length;
  }
  if (cursor < value.length) result.push(value.slice(cursor));
  return result;
}

function tableCells(value: string): string[] { return value.trim().replace(/^\|/u, "").replace(/\|$/u, "").split("|").map((cell) => cell.trim()); }
function safeHref(value: string): string | null {
  try { const url = new URL(value, "http://mirel.local"); return ["http:", "https:", "mailto:"].includes(url.protocol) ? value : null; }
  catch { return null; }
}

export function linkPlatform(value: string): WebPlatform | null {
  const known=webPlatform(value);if(known)return known;
  try {
    const url = new URL(value, "http://mirel.local");
    const host = url.hostname.toLowerCase();
    if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
    if (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.watch") return "facebook";
    if (value.startsWith("/") && !value.startsWith("//") && /^\/(reels|historias|analiticas)$/.test(url.pathname)) {
      const platform = url.searchParams.get("platform");
      return platform === "instagram" || platform === "facebook" ? platform : null;
    }
  } catch { /* Invalid links have no platform. */ }
  return null;
}

function AgentLinkPlatform({ href }: { href: string }) {
  const platform = linkPlatform(href);
  return platform ? <span className="agent-link-platform" data-platform={platform} title={platform}><PlatformIcon platform={platform} size={15} /></span> : null;
}

export function faviconUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? new URL("/favicon.ico", url.origin).toString() : null;
  } catch { return null; }
}

function standaloneHttpUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!/^https?:\/\/\S+$/iu.test(trimmed)) return null;
  const { href, tail } = splitRawUrl(trimmed);
  return !tail && safeHref(href) ? href : null;
}

function splitRawUrl(value: string): { href: string; tail: string } {
  const match = value.match(/^(.*?)([.,;:!?]+)?$/u);
  return { href: match?.[1] ?? value, tail: match?.[2] ?? "" };
}

export function AgentExternalUrl({ href, standalone = false, compact=false }: { href: string; standalone?: boolean;compact?:boolean }) {
  const platform = webPlatform(href);
  const icon = faviconUrl(href);
  const hostname = (() => { try { return new URL(href).hostname.replace(/^www\./iu, ""); } catch { return "sitio"; } })();
  const brand = hostname === "youtube.com" || hostname.endsWith(".youtube.com")
    ? "youtube"
    : hostname === "linkedin.com" || hostname.endsWith(".linkedin.com")
      ? "linkedin"
      : "site";
  return <a className="agent-rich-url" data-standalone={standalone} href={href} target="_blank" rel="noopener noreferrer" title={href}>
    {platform ? <span className="agent-link-platform" data-platform={platform}><PlatformIcon platform={platform} size={15}/></span> : <span className="agent-rich-url-icon" aria-hidden="true">
      <i data-brand={brand}>{brand === "youtube" ? "▶" : brand === "linkedin" ? "in" : "◉"}</i>
      {icon ? <img src={icon} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(event) => {
        const image = event.currentTarget;
        if (image.dataset.fallback !== "true") {
          image.dataset.fallback = "true";
          image.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`;
          return;
        }
        image.hidden = true;
      }} /> : null}
    </span>}
    <span>{compact?hostname:href}</span>
  </a>;
}
