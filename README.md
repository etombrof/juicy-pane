# juicy-pane

It's good, it's juicy 🧃

A side pane for Claude Code: jump between your own messages with Ctrl+↑ / Ctrl+↓, and see how full the context window is.

![juicy-pane: Ctrl+Up and Ctrl+Down jump between your messages](assets/navigator.gif)

## Features

- **Ctrl+↑ / Ctrl+↓**: previous / next message, marked with an orange box.
- **Ctrl+↓ after your last message**: back to the latest answer.
- **Side pane**: your messages, one line each, and where you are in the header (`24/27`). Click one to jump to it.
- **Context line**: `ctx ███░░░ 117k 12%` under the list. Yellow from 60%, red from 80%.

## Install

```
/plugin install juicy-pane --marketplace etombrof/juicy-pane
```

## Requirements

- Fullscreen view: `"tui": "fullscreen"` in `~/.claude/settings.json`
- `python3`

## Notes

- Narrow terminal: `/messages` opens the pane.
- Once you type in the prompt, Claude keeps Ctrl+↑/↓. In kitty, add to `kitty.conf`:

```
map ctrl+up   send_key alt+up
map ctrl+down send_key alt+down
```

## Tests

```
claude plugin test .
python3 -m unittest discover -s tests
```
