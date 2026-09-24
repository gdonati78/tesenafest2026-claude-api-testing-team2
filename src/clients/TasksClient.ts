import { BaseClient } from './BaseClient';
import type {
  CompletedTasksQuery,
  CreateTaskPayload,
  Task,
  TaskListQuery,
  UpdateTaskPayload,
} from './types';

/** Page of `tasks/completed/by_completion_date`. The live API omits `next_cursor` on the last page. */
interface CompletedTasksPage {
  items: Task[];
  next_cursor?: string | null;
}

export class TasksClient extends BaseClient {
  async create(payload: CreateTaskPayload): Promise<Task> {
    return this.postJson<Task>('tasks', payload);
  }

  async get(id: string): Promise<Task> {
    return this.getJson<Task>(`tasks/${id}`);
  }

  async update(id: string, payload: UpdateTaskPayload): Promise<Task> {
    return this.postJson<Task>(`tasks/${id}`, payload);
  }

  async delete(id: string): Promise<void> {
    await this.deleteResource(`tasks/${id}`);
  }

  /** Active (not completed) tasks matching the filter, across all pages. */
  async list(query: TaskListQuery = {}): Promise<Task[]> {
    return this.listAll<Task>('tasks', { ...query });
  }

  /** Tasks completed in the `since`–`until` window, across all pages. */
  async listCompletedByCompletionDate(query: CompletedTasksQuery): Promise<Task[]> {
    const tasks: Task[] = [];
    let cursor: string | null = null;
    do {
      const page: CompletedTasksPage = await this.getJson<CompletedTasksPage>(
        'tasks/completed/by_completion_date',
        { ...query, ...(cursor !== null && { cursor }) },
      );
      tasks.push(...page.items);
      cursor = page.next_cursor ?? null;
    } while (cursor !== null);
    return tasks;
  }

  /** Completes the task. A recurring task moves to its next due date instead. */
  async close(id: string): Promise<void> {
    await this.postEmpty(`tasks/${id}/close`);
  }

  /** Puts a completed task back among the active ones. */
  async reopen(id: string): Promise<void> {
    await this.postEmpty(`tasks/${id}/reopen`);
  }
}
