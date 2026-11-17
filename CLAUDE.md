# juicy-pane

A Claude Code mod (hooks module): a side pane listing your own messages, Ctrl+↑/↓ to jump between them, and a ctx line showing how full the context window is.

## Files

- `hooks/register.tsx`: the whole mod.
- `hooks/history.py`: reads the session transcript and prints your messages on the live branch plus the last 30 row ids. Run as `python3 -I history.py <project folder> <session id>`.
- `types/index.d.ts`: the `$.state` contract. Every atom key must be declared here, or `claude plugin validate` fails.
- `tests/`: kit tests (`*.test.tsx`) and Python tests (`test_history.py`).
- `.claude-plugin/types/`: written by the engine, gitignored. `claude-code/index.d.ts` is the API reference; grep it.

## How it works

- `msgs` is a module array of your messages (`{ id, label }`). It's filled at `session.start` from `history.py`, then from `session.append` for each prompt you send.
- **Pane** (`ui.render` on `Pane`, id `juicy-pane`): a header with your position, one Button per message (a click jumps to it), and the ctx line. It reads `here`, `selected`, `fill` and `paneRev`.
- **Key line** (`ui.render` on `AbovePrompt`): two Buttons bound to the actions `app:diffFileListUp` and `app:diffFileListDown`, which Ctrl/Alt+↑/↓ trigger. It reads no state.
- **Row tracking** (`ui.render` on `UserMessage`): each row reports `onScreen` into `report`; `publish` turns that into `here` (the highlight in the pane). The selected row gets an orange outline. Rows read `tick`.
- **Jumps**: `jumpTo` updates `here` and `selected`, scrolls with `$.ui.scroll` by message id, then recounts: bump `tick`, wait 300 ms, drop rows that didn't report, then `publish` with `settle`, which draws the pane once more.
- `move()` runs presses one after another, so each press is exactly one step, even with key repeat.

## Rules (each one was a bug)

- The key line must never change and must read no state. A Button whose drawing changes gets a new handle, and two quick redraws can leave the terminal pressing a released one: the keys stay dead until the next redraw. The debug log then says `ui.press: no Button of juicy-pane is held under handle N`. That's why the position is in the pane header, not on the key line.
- Never call `$.ui.invalidate('ui.render')`: it redraws every site, the key line and the pane included. A recount bumps the `tick` atom, which only rows read.
- Render hooks may not write state. Writes from them go through `$.clock.after`.
- Ctrl+↓ past your last message (to the bottom) keeps the block on your last message while it's on screen (`pastEnd`), like a jump to it. At the bottom your last 2 messages are often both on screen, and "topmost" put the block 1 up: a step down moved it up.
- Match rows to messages by id, never by text. A row's `requestId` is the transcript uuid, or its first 24 characters plus a 12-hex block index (Claude Code's internal rule `ek=24`, seen in 2.1.325, undocumented). Text matching broke on repeated messages like "go ahead".
- Pressing ← in an empty prompt moves the conversation into a background daemon job under a new session id. The new transcript holds only metadata rows until the next message, and the old file ends with `{"type":"continued-in","continuedInSessionId":"<new id>"}`. Message ids stay the same. `history.py` follows that link.
- A pane hook on another plugin's pane must name `plugin:` in its matcher, or it only hears its own plugin's drawings.
- Saving a file reloads the mod in every running session that loads it (through `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json`). Make risky changes in a copy first.

## Testing

```
claude plugin validate .
claude plugin test .
python3 -m unittest discover -s tests
npx -y -p typescript@5.6.3 tsc -p . --noEmit
```

- The kit's `$` has no `$.process` or `$.env`, and the kit can't scroll a transcript. That's why `history.py` is tested in Python.
- Races only show up live. Drive a real `claude` in a pty (Python + `pyte`), send keys like `\x1b[1;5A` (Ctrl+↑), run with `--debug-file`, and grep the log for `no Button of juicy-pane is held`. Holding Ctrl+↑ on a long session reproduced the stuck keys.
- To A/B a copy of the mod, run with `--setting-sources project --settings <your settings minus the env block> --plugin-dir <copy>`, so the live mod doesn't load as well.
- Resuming a copy of a long transcript costs no tokens as long as you send no prompt.

## Commit and push

- Commit only when asked.
- The repo-local author is already set: `etombrof <83461971+etombrof@users.noreply.github.com>`.
- Push: `GH_TOKEN=$(gh auth token -u etombrof) git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin main`

## Open

- Messages you rewind away stay in the pane until a restart.
- After a compaction, a row that disappeared can count as on screen until the next recount.
- When none of your messages is on screen, the highlight stays where it was.
- The README GIF (`assets/navigator.gif`) is outdated: it shows the old counter on the key line and no ctx line.
