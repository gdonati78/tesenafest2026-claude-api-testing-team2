import { uniqueName } from '../../src/data';
import { expect, Schema, test } from '../../src/fixtures';

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
});
