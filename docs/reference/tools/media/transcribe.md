# media_transcribe

Transcribe the speech in a video or audio file and write the timed transcript to a JSON file, with word-level start/end times in seconds; returns the file's path and its segment and word counts. Commonly useful for footage with speakers (talking head, interview), where the word times let you cut on a line. A transcript marks only speech; the gaps are not necessarily silent (music, score, applause).

| | |
| --- | --- |
| MCP tool | `media_transcribe` |
| CLI | `diffusion media transcribe <path>` |

## Input

| Field | Type | CLI | Description |
| --- | --- | --- | --- |
| `path` | `string`, required | `<path>` | absolute file path or URL (works with or without an open project), or a library path like `b-roll/clip.mp4` (needs an open project) |
| `output` | `string` | `-o, --output <path>` | absolute path to write the transcript JSON to (default: a fresh file under the system temp dir) |

Times are in **seconds** of source/content time. An `output` naming an existing directory gets a fresh `dapi-transcript-*.json` inside it. In Syka, Groq requires the user's configured key; prepared OGG chunks are cached persistently in the local profile by audio/model/duration/recognition-prompt, so complete chunks can survive a restart. The renderer reapplies offsets and the current local glossary after merging raw chunks. Changing aliases alone can reuse raw timing; changing preferred prompt terms can require another Groq request on the next explicit transcription. Every tool call writes its result file again.

The glossary uses exact whole-word/phrase corrections. Equal word counts preserve each original word interval. A contraction/expansion is one timed phrase with the original span's start/end, not estimated timestamps for newly spelled words. Saving glossary settings does not modify existing transcript/caption files or automatically upload/retranscribe media. See [Syka service map](../../../SERVICE_MAP_SYKA.md).

## Output

One JSON object, where the transcript went and how large it is:

```ts
{
  path:     string;   // absolute path of the transcript JSON
  segments: number;   // segments in the transcript
  words:    number;   // words across all segments
}
```

The file holds the transcript as indented JSON, so it searches line by line: a grep for a phrase lands on its segment's `text`, with the word times in the lines after it. Search it (grep, jq) or read the part you need rather than loading it whole — a long recording's word timings run to tens of thousands of tokens.

```ts
{
  segments: Array<{
    text:  string;      // spoken words only (no silence markers)
    words: Array<{ text: string; start: number; end: number }>;  // seconds
  }>;
}
```

## Errors

Fails clearly when Groq is not configured, the path can't be resolved, the asset is not video/audio, no recognizable speech is detected, provider quota/connection fails, or genuine word timing is invalid. Syka does not fall back to Diffusion cloud or fabricate per-word alignment.
