const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../core.js');
const task = (overrides = {}) => ({ id: 'one', title: '修复搜索', project: 'IssueDock', description: '支持中文 Search', status: 'backlog', priority: 'high', createdAt: '2026-10-22T00:00:00.000Z', ...overrides });
test('JSON backup preserves Unicode, multiline descriptions and all states', () => {
  const tasks = ['backlog', 'progress', 'done'].map((status, i) => task({ id: String(i), status, description: '第一行\n第二行 🌱' }));
  assert.deepEqual(core.parseBackup(core.backup(tasks)), tasks);
});
test('search matches description without case sensitivity and composes filters', () => {
  const tasks = [task(), task({ id: 'two', project: 'Other', priority: 'low' })];
  assert.equal(core.filterTasks(tasks, { search: ' SEARCH ', project: 'IssueDock', priority: 'high' }).length, 1);
  assert.equal(core.filterTasks(tasks, { search: '中文', priority: 'low' })[0].id, 'two');
  assert.equal(core.filterTasks(tasks, { project: 'missing' }).length, 0);
});
test('invalid backups fail before producing replacement data', () => {
  for (const invalid of ['{', 'null', '{}', '{"app":"IssueDock","version":2,"tasks":[]}']) assert.throws(() => core.parseBackup(invalid));
  assert.throws(() => core.validateTasks([task(), task()]));
  for (const invalid of [
    { status: '__proto__' }, { priority: 'constructor' }, { title: ' ' }, { id: '' },
    { createdAt: 'never' }, { title: 'x'.repeat(161) }, { project: 42 },
    { description: 'x'.repeat(5001) }, { status: [] }
  ]) assert.throws(() => core.validateTasks([task(invalid)]));
  assert.throws(() => core.validateTasks(Array.from({ length: 1001 }, (_, id) => task({ id: String(id) }))));
  assert.throws(() => core.parseBackup(' '.repeat(1048577)));
  assert.throws(() => core.backup(Array.from({ length: 100 }, (_, id) => task({ id: String(id), description: '字'.repeat(5000) }))));
});
test('validation strips unexpected fields without mutating the original data', () => {
  const original = task({ title: '  标题  ', arbitrary: '<script>bad()</script>' });
  const checked = core.validateTasks([original])[0];
  assert.equal(checked.title, '标题');
  assert.equal(checked.arbitrary, undefined);
  assert.equal(original.title, '  标题  ');
});
test('Markdown groups tasks and escapes HTML and formatting from imported text', () => {
  const output = core.markdown([task({ title: '<img src=x> [click](url)\n# header', status: 'done' })]);
  assert.ok(output.includes('- [x]'));
  assert.ok(output.includes('## 已完成'));
  assert.ok(!output.includes('<img'));
  assert.ok(!output.includes('\n# header'));
});
