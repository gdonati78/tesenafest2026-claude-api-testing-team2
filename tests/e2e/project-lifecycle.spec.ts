import type { Task } from '../../src/clients';
import { uniqueName } from '../../src/data';
import { expect, Schema, test } from '../../src/fixtures';

const HOUR_MS = 60 * 60 * 1000;

/** Ids sorted, so lists can be compared regardless of the order the API returns them in. */
function ids(tasks: readonly Pick<Task, 'id'>[]): string[] {
  return tasks.map((task) => task.id).sort();
}

test(
  'TC-011 A project from empty to done: three tasks, two ticked off, one still open at the end',
  { tag: ['@TC-011', '@e2e'] },
  async ({ api, testData }) => {
    const project = await test.step('Create a project', async () => {
      const created = await testData.createProject();
      expect(created).toMatchSchema(Schema.project);
      return created;
    });

    await test.step('List the open tasks of the new project: there are none', async () => {
      const open = await api.tasks.list({ project_id: project.id });
      expect(open).toEqual([]);
    });

    const { toClose, stillOpen } =
      await test.step('Create three tasks in the project', async () => {
        const createInProject = async (): Promise<Task> => {
          const content = uniqueName('task');
          const task = await testData.createTask({ content, project_id: project.id });
          expect(task).toMatchSchema(Schema.task);
          expect(task.project_id).toBe(project.id);
          expect(task.content).toBe(content);
          return task;
        };
        const first = await createInProject();
        const second = await createInProject();
        const third = await createInProject();
        return { toClose: [first, second], stillOpen: third };
      });

    await test.step('List the open tasks of the project: exactly the three tasks', async () => {
      const open = await api.tasks.list({ project_id: project.id });
      expect(ids(open)).toEqual(ids([...toClose, stillOpen]));
    });

    await test.step('Close two of the tasks', async () => {
      for (const task of toClose) {
        const response = await api.tasks.send('POST', `tasks/${task.id}/close`);
        expect(response.status()).toBe(204);
      }
    });

    await test.step('List the open tasks of the project: only the third task is left', async () => {
      const open = await api.tasks.list({ project_id: project.id });
      expect(ids(open)).toEqual([stillOpen.id]);
    });

    await test.step('Load each task: the closed ones are checked, the open one is not', async () => {
      for (const task of toClose) {
        const loaded = await api.tasks.get(task.id);
        expect(loaded).toMatchSchema(Schema.task);
        expect(loaded.checked).toBe(true);
      }
      const loaded = await api.tasks.get(stillOpen.id);
      expect(loaded).toMatchSchema(Schema.task);
      expect(loaded.checked).toBe(false);
    });

    await test.step('Find the two closed tasks among the completed tasks of the project', async () => {
      // A wide window, so clock drift between the runner and Todoist cannot hide the completions.
      const now = Date.now();
      const completed = await api.tasks.listCompletedByCompletionDate({
        project_id: project.id,
        since: new Date(now - HOUR_MS).toISOString(),
        until: new Date(now + HOUR_MS).toISOString(),
      });
      for (const task of completed) {
        expect(task).toMatchSchema(Schema.task);
      }
      expect(ids(completed)).toEqual(ids(toClose));
    });
  },
);
