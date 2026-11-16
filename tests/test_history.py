"""hooks/history.py. Run from the mod folder: python3 -m unittest discover -s tests"""
import importlib.util
import json
import os
import tempfile
import unittest

_spec = importlib.util.spec_from_file_location(
    'history', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'hooks', 'history.py'))
history = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(history)


def mine(uuid, parent, text):
    return {'type': 'user', 'uuid': uuid, 'parentUuid': parent, 'origin': {'kind': 'human'},
            'message': {'role': 'user', 'content': text}}


def answer(uuid, parent):
    return {'type': 'assistant', 'uuid': uuid, 'parentUuid': parent,
            'message': {'role': 'assistant', 'content': [{'type': 'text', 'text': 'ok'}]}}


class History(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.dir = tmp.name

    def write(self, sid, rows):
        with open(os.path.join(self.dir, sid + '.jsonl'), 'w') as f:
            f.write(''.join(json.dumps(r) + '\n' for r in rows))

    def test_moved_to_background_reads_the_file_it_came_from(self):
        # ← moved the conversation: it goes on as "new", whose file has metadata only for now
        self.write('old', [mine('a1', None, 'first'), answer('a2', 'a1'),
                           mine('b1', 'a2', 'rewound away'),  # a branch the person rewound
                           mine('a3', 'a2', 'second'), answer('a4', 'a3'),
                           {'type': 'continued-in', 'sessionId': 'old', 'continuedInSessionId': 'new'}])
        self.write('new', [{'type': 'ai-title', 'aiTitle': 'x', 'sessionId': 'new'}])
        self.write('other', [mine('z1', None, 'another session')])
        h = history.history(self.dir, 'new')
        self.assertEqual(h['mine'], [['a1', 'first'], ['a3', 'second']])
        self.assertEqual(h['tail'], ['a1', 'a2', 'a3', 'a4'])

    def test_new_rows_under_the_new_id_chain_into_the_old_file(self):
        self.write('old', [mine('a1', None, 'first'), answer('a2', 'a1'),
                           {'type': 'continued-in', 'continuedInSessionId': 'new'}])
        self.write('new', [{'type': 'ai-title'}, mine('a3', 'a2', 'second')])
        self.assertEqual([t for _, t in history.history(self.dir, 'new')['mine']], ['first', 'second'])

    def test_moved_twice(self):
        self.write('one', [mine('a1', None, 'first'), {'type': 'continued-in', 'continuedInSessionId': 'two'}])
        self.write('two', [{'type': 'ai-title'}, {'type': 'continued-in', 'continuedInSessionId': 'three'}])
        self.write('three', [{'type': 'ai-title'}])
        self.assertEqual(history.history(self.dir, 'three')['mine'], [['a1', 'first']])

    def test_a_complete_file_needs_no_other(self):
        self.write('new', [mine('a1', None, 'first'), answer('a2', 'a1'), mine('a3', 'a2', 'second')])
        self.write('old', [mine('x1', None, 'not this'), {'type': 'continued-in', 'continuedInSessionId': 'new'}])
        self.assertEqual([t for _, t in history.history(self.dir, 'new')['mine']], ['first', 'second'])

    def test_unknown_session_and_bad_lines(self):
        self.assertEqual(history.history(self.dir, 'missing'), {'mine': [], 'tail': []})
        with open(os.path.join(self.dir, 'broken.jsonl'), 'w') as f:
            f.write('not json\n' + json.dumps(mine('a1', None, 'kept')) + '\n{"cut off')
        self.assertEqual(history.history(self.dir, 'broken')['mine'], [['a1', 'kept']])

    def test_text_blocks_and_long_messages(self):
        long = 'x' * 500
        self.write('s', [{'type': 'user', 'uuid': 'a1', 'parentUuid': None, 'origin': {'kind': 'human'},
                          'message': {'content': [{'type': 'image'}, {'type': 'text', 'text': long}]}},
                         {'type': 'user', 'uuid': 'a2', 'parentUuid': 'a1', 'isMeta': True, 'origin': {'kind': 'human'},
                          'message': {'content': 'meta, not yours'}},
                         {'type': 'user', 'uuid': 'a3', 'parentUuid': 'a2', 'origin': {'kind': 'task-notification'},
                          'message': {'content': 'a notification'}}])
        self.assertEqual(history.history(self.dir, 's')['mine'], [['a1', 'x' * 200]])


if __name__ == '__main__':
    unittest.main()
