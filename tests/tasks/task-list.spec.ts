import { expect, Schema, test } from '../../src/fixtures';

test.describe('Task list', () => {
  test(
    "TC-008 A project's task list contains only the tasks of that project, nothing from elsewhere",
    { tag: ['@TC-008', '@regression'] },
    async ({ api, testData }) => {
      const { projectA, tasksInA } =
        await test.step('Create project A with two tasks', async () => {
          const project = await testData.createProject();
          const tasks = [
            await testData.createTask({ project_id: project.id }),
            await testData.createTask({ project_id: project.id }),
          ];
          return { projectA: project, tasksInA: tasks };
        });

      await test.step('Create tasks elsewhere: in project B and in the Inbox', async () => {
        const projectB = await testData.createProject();
        const inB = await testData.createTask({ project_id: projectB.id });
        expect(inB.project_id).toBe(projectB.id);
        const inInbox = await testData.createTask();
        expect(inInbox.project_id).not.toBe(projectA.id);
      });

      await test.step("Read the first page of project A's task list", async () => {
        const response = await api.tasks.send('GET', 'tasks', {
          query: { project_id: projectA.id },
        });
        expect(response.status()).toBe(200);
        const page: unknown = await response.json();
        expect(page).toMatchSchema(Schema.taskPage);
      });

      await test.step("Project A's task list holds exactly its own two tasks", async () => {
        const listed = await api.tasks.list({ project_id: projectA.id });
        for (const task of listed) {
          expect(task).toMatchSchema(Schema.task);
          expect(task.project_id).toBe(projectA.id);
        }
        expect(listed.map((task) => task.id).sort()).toEqual(
          tasksInA.map((task) => task.id).sort(),
        );
      });
    },
  );
});
