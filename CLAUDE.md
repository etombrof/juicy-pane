# juicy-pane

A Claude Code mod (hooks module): a side pane listing your own messages, Ctrl+↑/↓ to jump between them, and a `ctx` line for the context window. Repo `etombrof/juicy-pane`, public. Loaded in every session via `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json`.

## Parts

```
session.append ─▶ msgs (your messages) ◀── hooks/history.py (transcript, at session.start)
                    │
UserMessage rows ── report: which messages are on screen ──▶ publish ──▶ `here` (pane highlight)
                    │
key line (AbovePrompt): Ctrl+↑/↓ ──▶ move ──▶ jumpTo: `selected` + $.ui.scroll ──▶ recount
```

| File | What |
|---|---|
| `hooks/register.tsx` | All hooks: pane, key line, row tracking, jumps, ctx line |
| `hooks/history.py` | Your messages from the transcript, following the live branch and `continued-in` links |
| `types/index.d.ts` | `$.state` contract: `selected`, `here`, `fill`, `tick`, `paneRev` |
| `tests/*.test.tsx` | Kit tests (`claude plugin test .`) |
| `tests/test_history.py` | history.py tests |

## Rules (each one was a bug)

| Rule | Why |
|---|---|
| The key line reads no state and never changes | A Button drawn twice fast with different content can point at a released handle: keys stuck (`no Button of juicy-pane is held under handle N`) |
| Recount bumps `tick` (read by rows only), never `$.ui.invalidate` | invalidate redraws every site, the key line included |
| Match rows to messages by the first 24 chars of the id, never by text | Row ids are uuid[:24] + block index (Claude Code 2.1.325, undocumented); text matching broke on repeats like "go ahead" |
| A hook on another plugin's pane names `plugin:` in its matcher | Otherwise it hears only its own plugin's drawings |
| History follows `continued-in` | ← moves the conversation to a background job under a new session id; its transcript is empty until the next message |
| Presses run one at a time (`move` chain) | A held key's repeats otherwise read the same position |

## Test

```
claude plugin test .
python3 -m unittest discover -s tests
```

The kit's `$` has no `$.process` or `$.env`. Races (stuck keys) only show live: drive a real `claude` in a pty (pyte) with `--debug-file`, then grep the log for `no Button of juicy-pane is held`. For a copy of the mod, run `--setting-sources project --settings <your settings without env> --plugin-dir <copy>` so the live one doesn't load twice. Editing the live folder hot-reloads it in every open session.

## Commit and push

Author is repo-local: `etombrof <83461971+etombrof@users.noreply.github.com>`. Push without switching gh accounts:

```
GH_TOKEN=$(gh auth token -u etombrof) git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin main
```

## Open

| Item | Effect |
|---|---|
| Rewound messages stay in the pane | Gone after a restart |
| After a compaction a vanished row can count as on screen | Until the next recount |
| README GIF (`assets/navigator.gif`) is outdated | Shows the old counter, no ctx line |
