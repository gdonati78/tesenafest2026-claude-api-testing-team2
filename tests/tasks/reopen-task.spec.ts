import { expect, Schema, test } from '../../src/fixtures';

test.describe('Reopen task', () => {
  test(
    'TC-012 A task ticked off by mistake can be put back among the open ones, and it is the same task, not a new one',
    { tag: ['@TC-012', '@regression'] },
    async ({ api, testData }) => {
      const { project, created } = await test.step('Create a project with a task', async () => {
        const newProject = await testData.createProject();
        const task = await testData.createTask({ project_id: newProject.id });
        expect(task).toMatchSchema(Schema.task);
        expect(task.checked).toBe(false);
        return { project: newProject, created: task };
      });

      await test.step('Tick the task off', async () => {
        const response = await api.tasks.send('POST', `tasks/${created.id}/close`);
        expect(response.status()).toBe(204);
      });

      await test.step("The task is no longer among the project's open tasks", async () => {
        const open = await api.tasks.list({ project_id: project.id });
        expect(open.map((task) => task.id)).not.toContain(created.id);
      });

      await test.step('Reopen the task', async () => {
        const response = await api.tasks.send('POST', `tasks/${created.id}/reopen`);
        expect(response.status()).toBe(204);
      });

      await test.step('Load the task: it is the same task, open again', async () => {
        const loaded = await api.tasks.get(created.id);
        expect(loaded).toMatchSchema(Schema.task);
        expect(loaded).toMatchObject({
          id: created.id,
          content: created.content,
          project_id: project.id,
          added_at: created.added_at,
          checked: false,
          completed_at: null,
        });
      });

      await test.step('The project holds exactly that one open task, no new one', async () => {
        const open = await api.tasks.list({ project_id: project.id });
        for (const task of open) {
          expect(task).toMatchSchema(Schema.task);
        }
        expect(open.map((task) => task.id)).toEqual([created.id]);
      });
    },
  );
});
