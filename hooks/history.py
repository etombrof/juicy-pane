"""Your messages in a Claude Code session's transcript, for juicy-pane.

python3 -I history.py <project folder> <session id>
prints {"mine": [[uuid, text], ...], "tail": [uuid, ...]}: your messages on the live branch,
oldest first, and the ids of the branch's last 30 rows.

The branch is the parent chain from the newest row, so rewound branches are left out. When ←
moves a conversation to the background, it goes on under a new session id whose file holds no
rows at first; the old file ends with a "continued-in <new id>" row. A chain that stops short of
its root is followed into that older file, as many times as the conversation moved.
"""
import json
import os
import sys

TAIL_BYTES = 1 << 20  # the continued-in row is among a file's last few rows
MAX_HOPS = 8


def rows_of(path):
    """(uuid, parent uuid, is your message, text) for each row that has an id."""
    out = []
    try:
        f = open(path, encoding='utf-8', errors='replace')
    except OSError:
        return out
    with f:
        for line in f:
            try:
                r = json.loads(line)
            except ValueError:
                continue
            if not isinstance(r, dict) or not r.get('uuid'):
                continue
            mine = r.get('type') == 'user' and not r.get('isMeta') and (r.get('origin') or {}).get('kind') == 'human'
            text = ''
            if mine:
                c = (r.get('message') or {}).get('content')
                if isinstance(c, str):
                    text = c
                else:
                    text = next((b.get('text') or '' for b in (c or []) if isinstance(b, dict) and b.get('type') == 'text'), '')
            out.append((r['uuid'], r.get('parentUuid'), mine, (text or '')[:200]))
    return out


def chain(rows):
    """The parent chain from the newest row, oldest first."""
    by = {r[0]: r for r in rows}
    out, seen = [], set()
    r = rows[-1] if rows else None
    while r is not None and r[0] not in seen:
        seen.add(r[0])
        out.append(r)
        r = by.get(r[1]) if r[1] else None
    out.reverse()
    return out


def continued_from(folder, sid):
    """The session whose transcript says it continued in `sid`, newest file first; None if none."""
    try:
        names = [n for n in os.listdir(folder) if n.endswith('.jsonl') and n != sid + '.jsonl']
    except OSError:
        return None

    def mtime(name):
        try:
            return os.path.getmtime(os.path.join(folder, name))
        except OSError:
            return 0

    for name in sorted(names, key=mtime, reverse=True):
        try:
            with open(os.path.join(folder, name), 'rb') as f:
                f.seek(0, os.SEEK_END)
                f.seek(max(0, f.tell() - TAIL_BYTES))
                chunk = f.read()
        except OSError:
            continue
        for line in chunk.splitlines():
            if b'"continued-in"' not in line:
                continue
            try:
                r = json.loads(line)
            except ValueError:
                continue
            if isinstance(r, dict) and r.get('type') == 'continued-in' and r.get('continuedInSessionId') == sid:
                return name[: -len('.jsonl')]
    return None


def history(folder, sid):
    rows = rows_of(os.path.join(folder, sid + '.jsonl'))
    at, hops = sid, 0
    while hops < MAX_HOPS:
        c = chain(rows)
        if c and not c[0][1]:
            break  # reached the conversation's first row
        prev = continued_from(folder, at)
        if prev is None:
            break
        rows = rows_of(os.path.join(folder, prev + '.jsonl')) + rows
        at, hops = prev, hops + 1
    c = chain(rows)
    return {'mine': [[r[0], r[3]] for r in c if r[2]], 'tail': [r[0] for r in c[-30:]]}


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit('usage: history.py <project folder> <session id>')
    print(json.dumps(history(sys.argv[1], sys.argv[2])))
