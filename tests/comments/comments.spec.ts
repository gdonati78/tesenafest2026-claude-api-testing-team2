import { uniqueName } from '../../src/data';
import { expect, Schema, test } from '../../src/fixtures';

test(
  'TC-005 A comment is added to a task with the text that was entered',
  { tag: ['@TC-005', '@smoke'] },
  async ({ api, testData }) => {
    const content = uniqueName('comment');

    const task = await test.step('Create a task to comment on', () => testData.createTask());

    const created = await test.step('Add a comment with unique text to the task', () =>
      testData.createComment({ task_id: task.id }, { content }));

    await test.step('Check the create response has the entered text', () => {
      expect(created).toMatchSchema(Schema.comment);
      expect(created.content).toBe(content);
      expect(created.item_id).toBe(task.id);
    });

    await test.step('Load the comment by id and check its text', async () => {
      const comment = await api.comments.get(created.id);
      expect(comment).toMatchSchema(Schema.comment);
      expect(comment.id).toBe(created.id);
      expect(comment.content).toBe(content);
    });

    await test.step("Check the comment is in the task's comment list", async () => {
      const comments = await api.comments.list({ task_id: task.id });
      expect(comments.map((c) => c.id)).toContain(created.id);
    });
  },
);
