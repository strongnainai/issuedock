(function (root) {
  'use strict';
  const STATUSES = Object.freeze({ backlog: '待处理', progress: '进行中', done: '已完成' });
  const PRIORITIES = Object.freeze({ high: '高', medium: '中', low: '低' });
  const MAX_TASKS = 1000;
  const has = (object, key) => typeof key === 'string' && Object.hasOwn(object, key);
  function string(value, max, field, required = false) {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
      throw new Error(`${field}格式不正确或超出长度限制`);
    }
    return value;
  }
  function validateTasks(input) {
    if (!Array.isArray(input) || input.length > MAX_TASKS) throw new Error('任务列表格式不正确，最多支持 1000 项任务');
    const ids = new Set();
    return input.map(task => {
      if (!task || typeof task !== 'object' || Array.isArray(task)) throw new Error('任务格式不正确');
      const id = string(task.id, 100, '任务 ID', true);
      if (ids.has(id)) throw new Error('备份中存在重复的任务 ID');
      ids.add(id);
      if (!has(STATUSES, task.status) || !has(PRIORITIES, task.priority)) throw new Error('任务状态或优先级不正确');
      const createdAt = string(task.createdAt, 40, '创建时间', true);
      if (!Number.isFinite(Date.parse(createdAt))) throw new Error('创建时间不正确');
      return {
        id, title: string(task.title, 160, '标题', true).trim(),
        project: string(task.project, 80, '项目').trim(),
        description: string(task.description, 5000, '描述'),
        status: task.status, priority: task.priority, createdAt
      };
    });
  }
  function parseBackup(text) {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > 1048576) throw new Error('备份文件不得超过 1 MB');
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('文件不是有效的 JSON'); }
    if (!data || data.version !== 1 || data.app !== 'IssueDock') throw new Error('请选择 IssueDock 版本 1 的备份文件');
    return validateTasks(data.tasks);
  }
  function backup(tasks) {
    const text = JSON.stringify({ app: 'IssueDock', version: 1, exportedAt: new Date().toISOString(), tasks: validateTasks(tasks) }, null, 2);
    if (new TextEncoder().encode(text).length > 1048576) throw new Error('数据总量不得超过 1 MB，请精简任务描述');
    return text;
  }
  function filterTasks(tasks, { search = '', project = '', priority = '' } = {}) {
    const query = search.trim().toLocaleLowerCase();
    return tasks.filter(task => (!project || task.project === project) &&
      (!priority || task.priority === priority) &&
      (!query || [task.title, task.project, task.description].some(text => text.toLocaleLowerCase().includes(query))));
  }
  function markdown(tasks) {
    validateTasks(tasks);
    const inline = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}\[\]#!|~]/g, '\\$&').replace(/[\r\n]+/g, ' ');
    const lines = ['# IssueDock · 项目任务', ''];
    for (const [status, label] of Object.entries(STATUSES)) {
      lines.push(`## ${label}`, '');
      const group = tasks.filter(task => task.status === status);
      if (!group.length) lines.push('暂无任务', '');
      for (const task of group) {
        lines.push(`- [${status === 'done' ? 'x' : ' '}] ${inline(task.title)} · ${PRIORITIES[task.priority]}优先级`);
        if (task.project) lines.push(`  - 项目：${inline(task.project)}`);
        if (task.description) lines.push(`  - 描述：${inline(task.description)}`);
        lines.push('');
      }
    }
    return lines.join('\n');
  }
  const api = { STATUSES, PRIORITIES, MAX_TASKS, validateTasks, parseBackup, backup, filterTasks, markdown };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IssueDockCore = Object.freeze(api);
})(globalThis);
