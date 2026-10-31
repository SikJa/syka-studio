"""User-directed public reference inventory. No logins, scripts, or AI services.

Website prompt bodies are inspected in memory and hashed, not stored in the
durable corpus. Only the separately licensed GitHub snapshot retains text.
Transient HTML lives in --cache. Run again with the same cache to resume.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

SITE = "https://prompt-motion.com"
USER_AGENT = "SykaReferenceAudit/1.0 (user-directed local reference study; no training)"


def digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def normalized(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def flight_objects(html: str) -> list[dict]:
    chunks = []
    for match in re.finditer(r"self\.__next_f\.push\((\[.*?\])\)</script>", html, re.S):
        row = json.loads(match.group(1))
        if row[0] == 1:
            chunks.append(row[1])
    text = "".join(chunks)
    decoder = json.JSONDecoder()
    objects = []
    for match in re.finditer(r'\{"slug":', text):
        value, _ = decoder.raw_decode(text[match.start():])
        objects.append(value)
    return objects


class EntryParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.text = []
        self.prompt = []
        self.links = []
        self.times = []
        self.fields = {}
        self.field = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag not in {"img", "input", "meta", "link", "br", "source", "hr"}:
            self.stack.append((tag, attrs))
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "time" and attrs.get("dateTime", attrs.get("datetime")):
            self.times.append(attrs.get("dateTime", attrs.get("datetime")))
        if tag == "dt":
            self.field = ""

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if any(t in {"script", "style"} for t, _ in self.stack):
            return
        if any(a.get("id") == "entry-prompt" for _, a in self.stack):
            self.prompt.append(data)
        if data.strip():
            self.text.append(data.strip())
        if self.stack and self.stack[-1][0] == "dt":
            self.field = (self.field or "") + data.strip()
        if self.stack and self.stack[-1][0] == "dd" and self.field:
            self.fields[self.field] = self.fields.get(self.field, "") + data.strip()


def fetch(url: str, cache: Path, name: str) -> tuple[str | None, dict]:
    body = cache / (name + ".html")
    meta = cache / (name + ".http.json")
    if body.exists() and meta.exists():
        return body.read_text(encoding="utf-8-sig"), json.loads(meta.read_text(encoding="utf-8"))
    checked = datetime.now(timezone.utc).isoformat()
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            text = response.read().decode("utf-8")
            info = {"url": url, "resolvedUrl": response.url, "status": response.status,
                    "checkedAt": checked, "sha256": digest(text),
                    "etag": response.headers.get("ETag"), "bytes": len(text.encode("utf-8"))}
        body.write_text(text, encoding="utf-8")
    except urllib.error.HTTPError as error:
        info = {"url": url, "status": error.code, "checkedAt": checked,
                "error": str(error), "retryAfter": error.headers.get("Retry-After")}
        text = None
    except (OSError, TimeoutError) as error:
        info = {"url": url, "status": None, "checkedAt": checked, "error": str(error)}
        text = None
    meta.write_text(json.dumps(info, indent=2), encoding="utf-8")
    if info.get("status") == 429:
        raise RuntimeError("Rate limited. Stop and honor Retry-After; do not change identities.")
    return text, info


def summarize_entry(card: dict, html: str | None, http: dict) -> dict:
    result = {"slug": card["slug"], "url": SITE + "/" + card["slug"],
              "title": card["title"], "author": card["handle"], "date": card["date"],
              "tags": card["tags"], "promptSharedClaim": card["promptShared"],
              "posterUrl": card["poster"], "previewUrl": card["preview"],
              "videoUrl": card["video"], "width": card["width"], "height": card["height"],
              "http": http, "retention": "links_metadata_hashes_only"}
    if html is None:
        result.update(promptStatus="unavailable", postUrl=None)
        return result
    parser = EntryParser()
    parser.feed(html)
    prompt = "".join(parser.prompt).strip()
    visible = "\n".join(parser.text)
    links = list(dict.fromkeys(parser.links))
    originals = [u for u in links if re.match(r"https://(?:x|twitter)\.com/[^/]+/status/\d+", u)]
    note = visible[visible.find("Show all") + len("Show all"):] if "Show all" in visible else visible
    origin = "direct_post" if "taken directly" in note.lower() else "unspecified"
    if "reconstruct" in note.lower():
        origin = "curator_reconstruction"
    status = "absent" if not prompt else "complete_as_displayed"
    if prompt and re.search(r"partial prompt|part of (?:the|their) prompt|only part|excerpt", note, re.I):
        status = "partial"
    if prompt and origin == "curator_reconstruction":
        status = "reconstructed"
    result.update(postUrl=originals[0] if originals else None, promptStatus=status,
                  promptOrigin=origin, promptCharacters=len(prompt),
                  promptSha256=digest(prompt) if prompt else None,
                  promptNormalizedSha256=digest(normalized(prompt)) if prompt else None,
                  fields=parser.fields, detailDate=parser.times[0] if parser.times else None,
                  linkedResources=[u for u in links if u.startswith("https://") and
                                   not u.startswith("https://x.com/p4nthera_")],
                  promptFeatures=features(prompt + " " + card["title"]))
    return result


FEATURES = {
    "saas-launch": r"saas|product.{0,15}(?:film|launch|demo|video)|launch|landing page|app.{0,12}(?:promo|video)|spotify|linear",
    "kinetic-type": r"typograph|kinetic|stagger|word.?by.?word|text animation|type motion|showreel",
    "anchor-morph": r"morph|same (?:element|object)|one shape|continuity|liquid tab",
    "ui-demo": r"cursor|click|drag|slider|toggle|interface|dashboard|screen capture|screen recording|ui states",
    "explainer": r"explain|diagram|tutorial|recursion|how .{0,30}works|educational|lesson",
    "data-story": r"chart|graph|data visualization|statistic|counter|metric",
    "gallery": r"gallery|carousel|portfolio|image grid|card.{0,12}(?:fan|stack)|album",
    "portal-parallax": r"portal|parallax|infinite zoom|depth map|collage",
    "three-dimensional": r"three\.js|threejs|3d|glsl|webgl|shader|raymarch",
    "audio-sync": r"bpm|beat grid|downbeat|music|sound effects|audio reactive|soundtrack",
    "interactive": r"playable|game|interactive|physics simulation|raylib",
    "native-seek-contract": r"seek\(t\)|pure function of time|no timers|no state carried|deterministic|computed from time",
    "external-generation": r"magnific|seedream|kling|veo|sora|lyria|mcp.{0,10}(?:image|generate)|generate.{0,30}(?:images|assets)",
    "export-spec": r"\b(?:\d{2,4})\s?(?:fps|x\d|×\d)|mp4|render|export",
}


def features(text: str) -> list[str]:
    return [name for name, pattern in FEATURES.items() if re.search(pattern, text, re.I | re.S)]


def collect(root: Path, cache: Path):
    cache.mkdir(parents=True, exist_ok=True)
    home, home_http = fetch(SITE + "/", cache, "home")
    if not home:
        raise RuntimeError("The gallery could not be read.")
    cards = flight_objects(home)
    if not cards or not all("title" in c and "video" in c for c in cards):
        raise RuntimeError("Gallery schema changed; inspect it before collecting.")
    if len({c["slug"] for c in cards}) != len(cards):
        raise RuntimeError("Duplicate gallery slugs; do not silently lose entries.")
    policy = []
    for name in ["robots.txt", "sitemap.xml", "terms", "license"]:
        text, info = fetch(SITE + "/" + name, cache, "policy-" + name)
        policy.append(info)
        if name == "robots.txt" and text:
            (root / "provenance" / "prompt-motion-robots.txt").write_text(text, encoding="utf-8")
    entries = []
    for i, card in enumerate(cards):
        html, info = fetch(SITE + "/" + card["slug"], cache, card["slug"])
        entries.append(summarize_entry(card, html, info))
        if (i + 1) % 20 == 0:
            print(f"Prompt Motion: {i + 1}/{len(cards)} inspected", flush=True)
        time.sleep(0.15)
    path = root / "inventory" / "prompt-motion.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"schemaVersion": 1, "gallery": home_http,
                              "policyChecks": policy, "entries": entries}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"pages": len(entries), "http": dict(Counter(str(e["http"]["status"]) for e in entries)),
                      "prompts": dict(Counter(e["promptStatus"] for e in entries))}), flush=True)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    ap.add_argument("--cache", type=Path, default=Path(tempfile.gettempdir()) / "syka-prompt-motion-20261006")
    args = ap.parse_args()
    (args.root / "provenance").mkdir(parents=True, exist_ok=True)
    collect(args.root.resolve(), args.cache.resolve())
