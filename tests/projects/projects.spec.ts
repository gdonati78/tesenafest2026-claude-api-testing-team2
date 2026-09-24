import { uniqueName } from '../../src/data';
import { expect, Schema, test } from '../../src/fixtures';

test(
  'TC-001 A new project is created with the entered name',
  { tag: ['@TC-001', '@smoke'] },
  async ({ api, testData }) => {
    const name = uniqueName('project');

    const created = await test.step('Create a project with a unique name', async () => {
      const project = await testData.createProject({ name });
      expect(project.name).toBe(name);
      return project;
    });

    await test.step('Load the project by its id and check its name', async () => {
      const project = await api.projects.get(created.id);
      expect(project).toMatchSchema(Schema.project);
      expect(project.id).toBe(created.id);
      expect(project.name).toBe(name);
    });
  },
);
