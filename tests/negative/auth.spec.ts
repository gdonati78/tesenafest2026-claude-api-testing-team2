import type { TodoistApi } from '../../src/clients';
import { uniqueName } from '../../src/data';
import { expect, test, type TestData } from '../../src/fixtures';

// A fixed, obviously fake value. Never derive it from the real token: redaction only matches the
// whole real token, so a truncated or altered copy of it would end up in traces and reports.
const MALFORMED_TOKEN = 'autotest-malformed-token';

// The pinned spec has no body schema for 401, so the observed body is asserted (probed 2026-09-24).
const UNAUTHORIZED_BODY = { http_code: 401, error_tag: 'UNAUTHORIZED', error_code: 477 };

/** Sends a create-project request with `client` and checks, with the valid token, that nothing was created. */
async function expectRejectedAndNothingCreated(
  client: TodoistApi,
  api: TodoistApi,
  testData: TestData,
  name: string,
): Promise<void> {
  await test.step('Send a create-project request and check it is rejected with 401', async () => {
    const response = await client.projects.send('POST', 'projects', { body: { name } });
    // Soft, so the next step still runs: if a project was created after all, it finds and tracks it.
    expect.soft(response.status()).toBe(401);
    expect.soft(await response.json()).toMatchObject(UNAUTHORIZED_BODY);
  });

  await test.step('List projects with the valid token and check none has the sent name', async () => {
    const matches = (await api.projects.list()).filter((project) => project.name === name);
    matches.forEach((project) => {
      testData.track('project', project.id);
    });
    expect(matches).toEqual([]);
  });
}

test(
  'TC-014a With no access token the create-project request fails with 401 and nothing is created',
  { tag: ['@TC-014', '@negative'] },
  async ({ api, unauthenticatedApi, testData }) => {
    await expectRejectedAndNothingCreated(unauthenticatedApi, api, testData, uniqueName('project'));
  },
);

test(
  'TC-014b With a malformed token the create-project request fails with 401 and nothing is created',
  { tag: ['@TC-014', '@negative'] },
  async ({ api, apiWithToken, testData }) => {
    const malformedApi = await apiWithToken(MALFORMED_TOKEN);
    await expectRejectedAndNothingCreated(malformedApi, api, testData, uniqueName('project'));
  },
);
