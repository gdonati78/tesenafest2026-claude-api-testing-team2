/* global fetch, process */
// Throwaway probe of the real Todoist API. Copy to the scratchpad, edit, never commit the copy.
// Run: node --env-file=.env <scratchpad>/probe.mjs
// Never print the token or the headers.
const base = 'https://api.todoist.com/api/v1/';
const headers = {
  Authorization: `Bearer ${process.env.TODOIST_API_TOKEN}`,
  'Content-Type': 'application/json',
};
const call = async (method, path, body) => {
  const res = await fetch(base + path, { method, headers, body: body && JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};
const log = (label, value) => process.stdout.write(`${label} ${JSON.stringify(value)}\n`);

// The autotest- prefix lets global-setup remove leftovers if the probe crashes.
const stamp = `autotest-probe-${Date.now()}`;
const project = await call('POST', 'projects', { name: `${stamp}-project` });
try {
  const user = await call('GET', 'user');
  log('account', { tz: user.body.tz_info.timezone, premium: user.body.is_premium });

  // --- probe calls go here ---
  const task = await call('POST', 'tasks', {
    content: `${stamp}-task`,
    project_id: project.body.id,
  });
  log('create', { status: task.status, body: task.body });
  const loaded = await call('GET', `tasks/${task.body.id}`);
  log('reload', { status: loaded.status, body: loaded.body });
} finally {
  // Deleting the project also deletes its tasks. Delete labels separately.
  const deleted = await call('DELETE', `projects/${project.body.id}`);
  log('cleanup', deleted.status);
}
