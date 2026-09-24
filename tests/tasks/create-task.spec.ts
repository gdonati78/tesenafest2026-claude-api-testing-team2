import type { CreateTaskPayload, Task } from '../../src/clients';
import { uniqueName } from '../../src/data';
import { expect, Schema, test } from '../../src/fixtures';
import { addDays, todayIn, tomorrowIn } from '../../src/utils/dates';

test.describe('Create task', () => {
  test(
    'TC-002 A new task is created with the text that was entered',
    { tag: ['@TC-002', '@smoke'] },
    async ({ api, testData }) => {
      const content = uniqueName('task');

      const created = await test.step('Create a task with the entered text', async () => {
        const task = await testData.createTask({ content });
        expect(task).toMatchSchema(Schema.task);
        expect(task.content).toBe(content);
        return task;
      });

      await test.step('Load the task again and check its text', async () => {
        const loaded = await api.tasks.get(created.id);
        expect(loaded).toMatchSchema(Schema.task);
        expect(loaded.id).toBe(created.id);
        expect(loaded.content).toBe(content);
      });
    },
  );

  test(
    'TC-003 A new task is created with the due date that was entered',
    { tag: ['@TC-003', '@smoke'] },
    async ({ api, testData, accountTimezone }) => {
      const dueDate = await test.step('Compute tomorrow in the account timezone', () =>
        tomorrowIn(accountTimezone));

      const created = await test.step('Create a task with the entered due date', async () => {
        const task = await testData.createTask({ content: uniqueName('task'), due_date: dueDate });
        expect(task).toMatchSchema(Schema.task);
        expect(task.due).not.toBeNull();
        expect(task.due?.date).toBe(dueDate);
        expect(task.due?.is_recurring).toBe(false);
        return task;
      });

      await test.step('Load the task again and check its due date', async () => {
        const loaded = await api.tasks.get(created.id);
        expect(loaded).toMatchSchema(Schema.task);
        expect(loaded.id).toBe(created.id);
        expect(loaded.due?.date).toBe(dueDate);
      });
    },
  );

  test(
    'TC-007a A task can be created with the required fields only',
    { tag: ['@TC-007', '@regression'] },
    async ({ api, testData, account }) => {
      const content = uniqueName('task');
      const expectDefaults = (task: Task): void => {
        expect(task).toMatchObject({
          content,
          project_id: account.inbox_project_id,
          parent_id: null,
          description: '',
          labels: [],
          priority: 1,
          due: null,
          deadline: null,
          duration: null,
          checked: false,
        });
      };

      const created = await test.step('Create a task with the content only', async () => {
        const task = await testData.createTask({ content });
        expect(task).toMatchSchema(Schema.task);
        return task;
      });

      await test.step('Check that the fields not entered have their default values', () => {
        expectDefaults(created);
      });

      await test.step('Load the task again and check the same values', async () => {
        const loaded = await api.tasks.get(created.id);
        expect(loaded).toMatchSchema(Schema.task);
        expect(loaded.id).toBe(created.id);
        expectDefaults(loaded);
      });
    },
  );

  test(
    'TC-007b Every optional field of a task is stored exactly as it was entered',
    { tag: ['@TC-007', '@regression'] },
    async ({ api, testData, accountTimezone }) => {
      const { project, label, parent } =
        await test.step('Create a project, a label and a parent task', async () => {
          const project = await testData.createProject();
          const label = await testData.createLabel();
          const parent = await testData.createTask({ project_id: project.id });
          return { project, label, parent };
        });

      // duration and deadline_date are not on the free plan, they are covered by TC-007c.
      // Priority 3, not the default 1, so the test proves the value was stored.
      const payload = {
        content: uniqueName('task'),
        description: 'autotest description: every optional field',
        project_id: project.id,
        parent_id: parent.id,
        order: 3,
        labels: [label.name],
        priority: 3,
        due_date: tomorrowIn(accountTimezone),
      } satisfies CreateTaskPayload;

      const expectAsEntered = (task: Task): void => {
        expect(task).toMatchObject({
          content: payload.content,
          description: payload.description,
          project_id: payload.project_id,
          parent_id: payload.parent_id,
          child_order: payload.order,
          labels: payload.labels,
          priority: payload.priority,
          due: { date: payload.due_date, is_recurring: false },
        });
      };

      const created = await test.step('Create a task with every optional field', async () => {
        const task = await testData.createTask(payload);
        expect(task).toMatchSchema(Schema.task);
        expectAsEntered(task);
        return task;
      });

      await test.step('Load the task again and check every field', async () => {
        const loaded = await api.tasks.get(created.id);
        expect(loaded).toMatchSchema(Schema.task);
        expect(loaded.id).toBe(created.id);
        expectAsEntered(loaded);
      });
    },
  );

  test(
    'TC-007c A duration and a deadline are stored exactly as they were entered',
    { tag: ['@TC-007', '@regression'] },
    async ({ api, testData, accountTimezone }) => {
      test.fixme(
        true,
        'Not on the free plan: deadline_date is rejected with 403 PREMIUM_ONLY and duration is ' +
          'silently dropped (probed 2026-09-24).',
      );
      const payload = {
        content: uniqueName('task'),
        due_date: tomorrowIn(accountTimezone),
        duration: 30,
        duration_unit: 'minute',
        deadline_date: addDays(todayIn(accountTimezone), 7),
      } satisfies CreateTaskPayload;

      const expectAsEntered = (task: Task): void => {
        expect(task).toMatchObject({
          duration: { amount: payload.duration, unit: payload.duration_unit },
          deadline: { date: payload.deadline_date },
        });
      };

      const created = await test.step('Create a task with a duration and a deadline', async () => {
        const task = await testData.createTask(payload);
        expect(task).toMatchSchema(Schema.task);
        expectAsEntered(task);
        return task;
      });

      await test.step('Load the task again and check the duration and the deadline', async () => {
        const loaded = await api.tasks.get(created.id);
        expect(loaded).toMatchSchema(Schema.task);
        expectAsEntered(loaded);
      });
    },
  );
});
