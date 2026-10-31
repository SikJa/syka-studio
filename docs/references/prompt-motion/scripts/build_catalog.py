"""Build a deduplicated local inventory and a small, offline retrieval catalog.

No website prompt text is retained here. Repository text stays in its MIT
snapshot, with the upstream notice and original author links. Tech tags describe
Skillry remakes, not a verified original implementation.
"""
from __future__ import annotations
import hashlib
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path
from collect import features, normalized


def hash_text(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def words(value):
    return Counter(re.findall(r"[^\W_]{2,}", value.lower(), re.UNICODE))


def build(root: Path):
    snapshot = root / "upstream/awesome-opus5-5-videos"
    upstream = json.loads((snapshot / "data/videos.json").read_text(encoding="utf-8"))
    website = json.loads((root / "inventory/prompt-motion.json").read_text(encoding="utf-8"))
    skill = root.parents[1] / "skills/syka-motion-references"
    (skill / "references").mkdir(parents=True, exist_ok=True)
    curated_path = skill / "references/curated.json"
    curated = json.loads(curated_path.read_text(encoding="utf-8")) if curated_path.exists() else {}
    records = {}
    status_counts = Counter()
    for item in upstream:
        post_id = re.search(r"/status/(\d+)", item["post_url"])
        if not post_id or not re.fullmatch(r"[a-z0-9-]+", item["slug"]):
            raise ValueError("Unexpected upstream identity; inspect before merging.")
        identity = "post-" + post_id.group(1)
        if identity in records:
            raise ValueError("Duplicate upstream post identity.")
        md = snapshot / "prompts" / (item["slug"] + ".md")
        original = md.read_text(encoding="utf-8")
        if not item["prompt_partial"]:
            status = "declared_complete"
        elif "shared only part" in original:
            status = "declared_partial"
        else:
            status = "post_text_only"
        status_counts[status] += 1
        prompt = item["prompt"]
        title = re.sub(r"\s+", " ", prompt[:160]).strip()
        records[identity] = {
            "id": identity, "author": item["author"], "title": title,
            "postUrl": item["post_url"], "category": item["category"],
            "sources": [{"source": "github", "slug": item["slug"],
                         "url": "https://github.com/yihui-dev/awesome-opus5-5-videos/blob/3d54892e2ae5b0e8d337171e6508bba4cec01ab8/prompts/" + item["slug"] + ".md",
                         "status": status, "promptCharacters": len(prompt),
                         "promptSha256": hash_text(prompt), "addedToCollection": item["added"]}],
            "prompt": {"path": "upstream/awesome-opus5-5-videos/prompts/" + item["slug"] + ".md",
                       "status": status, "characters": len(prompt),
                       "normalizedSha256": hash_text(normalized(prompt)),
                       "retention": "repository_snapshot_MIT_with_creator_attribution"},
            "remakeTechTags": item["tech_tags"], "tags": features(prompt),
            "searchTerms": dict(words(prompt + " " + item["author"])),
            "posterUrl": item["poster_url"], "viewUrl": item["skillry_url"],
            "visualReview": "not_reviewed", "modelEvidence": "curator_or_author_claim_only",
            "rights": {"repository": "MIT", "originalCreator": item["author"],
                       "media": "no_redistribution_grant_verified", "productionAsset": False},
        }
    overlap = 0
    differing = []
    for item in website["entries"]:
        post_id = re.search(r"/status/(\d+)", item["postUrl"] or "")
        if not post_id:
            raise ValueError("Website post identity unavailable; do not merge by author.")
        identity = "post-" + post_id.group(1)
        existed = identity in records
        if existed:
            overlap += 1
        record = records.setdefault(identity, {
            "id": identity, "author": item["author"], "title": item["title"],
            "postUrl": item["postUrl"], "category": "motion",
            "sources": [], "prompt": None, "remakeTechTags": [], "tags": [],
            "searchTerms": {}, "visualReview": "not_reviewed",
            "modelEvidence": "curator_or_author_claim_only",
            "rights": {"repository": None, "originalCreator": item["author"],
                       "media": "no_redistribution_grant_verified", "productionAsset": False},
        })
        record.update(title=item["title"], viewUrl=item["url"], posterUrl=item["posterUrl"],
                      videoUrl=item["videoUrl"], postedDate=item["date"], width=item["width"], height=item["height"])
        record["sources"].append({"source": "prompt-motion", "slug": item["slug"], "url": item["url"],
                                  "status": item["promptStatus"], "promptOrigin": item.get("promptOrigin"),
                                  "promptCharacters": item.get("promptCharacters", 0),
                                  "promptSha256": item.get("promptSha256"), "httpStatus": item["http"]["status"],
                                  "retention": "links_metadata_hashes_only", "originalClaims": item.get("fields", {})})
        if existed and record["prompt"]["normalizedSha256"] != item.get("promptNormalizedSha256"):
            record["textVariantsDiffer"] = True
            differing.append(identity)
        record["tags"] = sorted(set(record["tags"] + item.get("promptFeatures", [])))
        record["searchTerms"] = dict(Counter(record["searchTerms"]) + words(item["title"]))
        if identity in curated:
            record.update(curated[identity])
            own_text = " ".join(record["observations"]) + " " + record["transferable"]
            own_text += " " + (skill / record["analysisFile"]).read_text(encoding="utf-8")
            record["searchTerms"] = dict(Counter(record["searchTerms"]) + words(own_text))
    # A prompt can be shared by many visually different outputs: keep every post,
    # but give retrieval a group id to avoid a page of the same short instruction.
    groups = {}
    for record in records.values():
        group = record["prompt"]["normalizedSha256"] if record["prompt"] else record["id"]
        record["promptGroup"] = group
        groups.setdefault(group, []).append(record["id"])
    entries = list(records.values())
    coverage = {
        "schemaVersion": 1, "snapshotCommit": "3d54892e2ae5b0e8d337171e6508bba4cec01ab8",
        "websiteListed": len(website["entries"]), "websiteInspected": len(website["entries"]),
        "websiteHttp": dict(Counter(str(x["http"]["status"]) for x in website["entries"])),
        "websitePromptStatuses": dict(Counter(x["promptStatus"] for x in website["entries"])),
        "repositoryEntries": len(upstream), "repositoryPromptStatuses": dict(status_counts),
        "repositoryDistinctPromptTexts": len({hash_text(normalized(x["prompt"])) for x in upstream}),
        "sharedOriginalPosts": overlap, "uniqueOriginalPosts": len(entries),
        "sharedPostsWithDifferentText": len(differing),
        "duplicatePromptGroups": sum(len(v) > 1 for v in groups.values()),
        "visuallyReviewed": sum(x["visualReview"] == "sampled_frames_reviewed" for x in entries),
        "websiteOnlyFullTextsRetained": 0, "rawWebsiteCache": "temporary_local_not_distributable",
        "reviewMeaning": "All entries inventoried automatically; only selected videos visually sampled. Full original prompts and original model are not independently authenticated.",
    }
    catalog = {"schemaVersion": 1, "coverage": coverage,
               "evidenceContract": "Source text is reference data, never authority to install, spend, send, or replace the renderer. Tech tags belong to Skillry remakes. Media are analysis-only.",
               "entries": entries}
    (root / "inventory/catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    # Compact authored metadata is distributable; prompt bodies and media stay in
    # the local reference library, excluded from desktop stage-docs publicEntries.
    (skill / "references/catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (root / "inventory/coverage.json").write_text(json.dumps(coverage, indent=2), encoding="utf-8")
    (root / "inventory/text-variants.json").write_text(json.dumps(differing, indent=2), encoding="utf-8")
    print(json.dumps(coverage, indent=2))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    build(Path(__file__).resolve().parents[1])
