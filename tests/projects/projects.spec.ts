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

test(
  'TC-006 A renamed project loads under the new name when opened again',
  { tag: ['@TC-006'] },
  async ({ api, testData }) => {
    const originalName = uniqueName('project');
    const newName = uniqueName('project-renamed');

    const created = await test.step('Create a project with a unique name', () =>
      testData.createProject({ name: originalName }));

    await test.step('Rename the project and check the update response', async () => {
      const updated = await api.projects.update(created.id, { name: newName });
      expect(updated.name).toBe(newName);
    });

    await test.step('Load the project by its id and check it has the new name', async () => {
      const project = await api.projects.get(created.id);
      expect(project).toMatchSchema(Schema.project);
      expect(project.id).toBe(created.id);
      expect(project.name).toBe(newName);
      expect(project.name).not.toBe(originalName);
    });
  },
);
