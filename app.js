(() => {
  'use strict';
  const core = window.IssueDockCore;
  const KEY = 'issuedock.tasks.v1';
  const $ = id => document.getElementById(id);
  const dialog = $('task-dialog');
  const form = $('task-form');
  let tasks = [];
  let editing = null;
  let noticeTimer;
  let storageBlocked = false;
  function notice(message, error = false) {
    clearTimeout(noticeTimer);
    const box = $('notice');
    box.textContent = message;
    box.dataset.error = String(error);
    box.hidden = false;
    if (!error) noticeTimer = setTimeout(() => { box.hidden = true; }, 5000);
  }
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) tasks = core.parseBackup(saved);
  } catch {
    storageBlocked = true;
    notice('无法读取已存数据。为避免覆盖，保存已暂停。请先备份原有浏览器数据，或通过“恢复备份”导入有效备份。', true);
  }
  function commit(next, recovering = false) {
    if (storageBlocked && !recovering) { notice('保存已暂停：请先通过“恢复备份”导入有效备份。', true); return false; }
    try {
      const serialized = core.backup(next);
      localStorage.setItem(KEY, serialized);
      tasks = core.parseBackup(serialized);
      storageBlocked = false;
      render();
      return true;
    } catch (error) { notice(`未保存：${error.message}`, true); return false; }
  }
  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }
  function action(label, handler, className = '') {
    const button = element('button', className, label);
    button.type = 'button';
    button.addEventListener('click', handler);
    return button;
  }
  function card(task) {
    const article = element('article', 'card');
    const meta = element('div', 'card-meta');
    meta.append(element('span', 'project-label', task.project || '未分类'), element('span', `priority ${task.priority}`, `${core.PRIORITIES[task.priority]}优先级`));
    article.append(meta, element('h3', '', task.title));
    if (task.description) article.append(element('p', '', task.description));
    const bottom = element('div', 'card-bottom');
    const select = element('select');
    select.setAttribute('aria-label', `更改“${task.title}”的状态`);
    for (const [value, label] of Object.entries(core.STATUSES)) select.add(new Option(label, value));
    select.value = task.status;
    select.addEventListener('change', () => {
      if (commit(tasks.map(item => item.id === task.id ? { ...item, status: select.value } : item))) notice('任务状态已更新');
      else select.value = task.status;
    });
    const buttons = element('div', 'card-tools');
    buttons.append(action('编辑', () => openForm(task)), action('删除', () => {
      if (window.confirm(`删除任务“${task.title}”？此操作无法撤销。`)) {
        if (commit(tasks.filter(item => item.id !== task.id))) notice('任务已删除');
      }
    }, 'delete'));
    bottom.append(select, buttons);
    article.append(bottom);
    return article;
  }
  function render() {
    const previousProject = $('project-filter').value;
    $('project-filter').replaceChildren(new Option('全部项目', ''));
    [...new Set(tasks.map(task => task.project).filter(Boolean))].sort().forEach(project => $('project-filter').add(new Option(project, project)));
    $('project-filter').value = [...$('project-filter').options].some(option => option.value === previousProject) ? previousProject : '';
    const visible = core.filterTasks(tasks, { search: $('search').value, project: $('project-filter').value || '', priority: $('priority-filter').value });
    $('total-count').textContent = tasks.length;
    $('progress-count').textContent = tasks.filter(task => task.status === 'progress').length;
    const done = tasks.filter(task => task.status === 'done').length;
    $('done-count').textContent = done;
    $('completion').textContent = `完成率 ${tasks.length ? Math.round(done / tasks.length * 100) : 0}%`;
    $('filter-summary').textContent = `显示 ${visible.length} / ${tasks.length} 项任务`;
    $('board').replaceChildren();
    for (const [status, label] of Object.entries(core.STATUSES)) {
      const column = element('section', 'column');
      column.dataset.status = status;
      const heading = element('div', 'column-heading');
      const title = element('h2', '', label);
      title.id = `heading-${status}`;
      column.setAttribute('aria-labelledby', title.id);
      const group = visible.filter(task => task.status === status);
      const add = action('+', () => openForm(null, status), 'column-add');
      add.setAttribute('aria-label', `添加${label}任务`);
      heading.append(element('span', 'dot'), title, element('span', 'column-count', group.length), add);
      const cards = element('div', 'cards');
      group.forEach(task => cards.append(card(task)));
      if (!group.length) {
        const empty = element('p', 'empty');
        empty.append(element('span', '', '＋'), document.createTextNode(tasks.length ? '暂无符合条件的任务' : '留个位置，给下一件值得做的事'));
        cards.append(empty);
      }
      column.append(heading, cards);
      $('board').append(column);
    }
  }
  function openForm(task = null, status = 'backlog') {
    $('task-title').setCustomValidity('');
    editing = task ? task.id : null;
    form.reset();
    $('dialog-title').textContent = task ? '编辑任务' : '新建任务';
    for (const field of ['title', 'project', 'description']) form.elements[field].value = task ? task[field] : '';
    form.elements.status.value = task ? task.status : status;
    form.elements.priority.value = task ? task.priority : 'medium';
    dialog.showModal();
    $('task-title').focus();
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    data.title = data.title.trim();
    if (!data.title) { $('task-title').setCustomValidity('请输入任务标题'); $('task-title').reportValidity(); return; }
    let next;
    if (editing) next = tasks.map(task => task.id === editing ? { ...task, ...data } : task);
    else {
      const id = globalThis.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      next = [{ ...data, id, createdAt: new Date().toISOString() }, ...tasks];
    }
    if (commit(next)) { dialog.close(); notice(editing ? '任务已更新' : '任务已添加'); }
  });
  $('task-title').addEventListener('input', () => $('task-title').setCustomValidity(''));
  $('add-task').addEventListener('click', () => { $('task-title').setCustomValidity(''); openForm(); });
  $('close-dialog').addEventListener('click', () => dialog.close());
  $('cancel-task').addEventListener('click', () => dialog.close());
  $('search').addEventListener('input', render);
  for (const id of ['project-filter', 'priority-filter']) $(id).addEventListener('change', render);
  $('reset-filters').addEventListener('click', () => { $('search').value = ''; $('project-filter').value = ''; $('priority-filter').value = ''; render(); });
  function download(content, type, filename) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = element('a');
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('export-json').addEventListener('click', () => {
    if (storageBlocked) { notice('当前无法读取存储，请先保留浏览器中的原始数据，避免使用空备份覆盖。', true); return; }
    download(core.backup(tasks), 'application/json;charset=utf-8', `issuedock-${new Date().toISOString().slice(0, 10)}.json`);
  });
  $('export-md').addEventListener('click', () => {
    if (storageBlocked) { notice('当前无法读取存储，暂不能导出。', true); return; }
    download(core.markdown(tasks), 'text/markdown;charset=utf-8', 'issuedock-tasks.md');
  });
  $('import-json').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 1048576) throw new Error('备份文件不得超过 1 MB');
      const restored = core.parseBackup(await file.text());
      if (!window.confirm(`恢复 ${restored.length} 项任务将替换当前浏览器中的全部任务。请确认已备份现有数据。继续？`)) return;
      if (commit(restored, true)) notice(`已恢复 ${restored.length} 项任务`);
    } catch (error) { notice(`恢复失败：${error.message}`, true); }
  });
  $('load-demo').addEventListener('click', () => {
    const samples = [
      ['梳理下一版的功能清单', 'IssueDock · 示例', 'backlog', 'medium', '收集反馈，为下一次迭代设定清晰的范围。'],
      ['让第一次使用更轻松', '文档 · 示例', 'backlog', 'low', '检查 README 中的快速开始，让新贡献者也能顺利上手。'],
      ['验证备份与恢复流程', 'IssueDock · 示例', 'progress', 'high', '先导出 JSON，再恢复备份，确认任务、状态和描述完整保留。'],
      ['给项目选择开源许可证', 'IssueDock · 示例', 'done', 'medium', '清晰说明使用、修改和分发的权利，让协作更安心。']
    ];
    if (tasks.some(task => task.id.startsWith('demo-'))) { notice('示例已经添加过了'); return; }
    const demo = samples.map(([title, project, status, priority, description], index) => ({ id: `demo-${index}`, title, project, status, priority, description, createdAt: new Date().toISOString() }));
    if (commit([...tasks, ...demo])) notice('已添加 4 项示例，可随时编辑或删除');
  });
  window.addEventListener('storage', event => {
    if (event.key !== KEY && event.key !== null) return;
    try {
      const saved = localStorage.getItem(KEY);
      tasks = saved === null ? [] : core.parseBackup(saved);
      storageBlocked = false; render();
      if (dialog.open) { dialog.close(); notice('其他页面更新了数据，编辑窗口已关闭，请重新编辑。'); }
      else notice('已同步此浏览器其他页面的变更');
    } catch { storageBlocked = true; notice('其他页面的数据无效，保存已暂停。', true); }
  });
  render();
})();
