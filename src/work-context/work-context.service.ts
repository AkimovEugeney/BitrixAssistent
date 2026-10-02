import { Injectable } from '@nestjs/common';
import { LocalStateService, WorkContextRecord } from '../storage/local-state.service';

@Injectable()
export class WorkContextService {
  constructor(private readonly state: LocalStateService) {}

  async get(userId: string): Promise<WorkContextRecord> {
    const existing = (await this.state.read()).workContexts.find((item) => item.userId === userId);
    return existing ?? this.newContext(userId);
  }

  async setTask(userId: string, taskId: number, projectAlias: string | null): Promise<WorkContextRecord> {
    const context = { ...this.newContext(userId), currentTaskId: taskId, currentProjectAlias: projectAlias, updatedAt: new Date().toISOString() };
    await this.save(context);
    return context;
  }

  async clearTask(userId: string): Promise<WorkContextRecord> {
    const current = await this.get(userId);
    const context = { ...current, currentTaskId: null, updatedAt: new Date().toISOString() };
    await this.save(context);
    return context;
  }

  private newContext(userId: string): WorkContextRecord {
    return { id: userId, userId, currentProjectAlias: null, currentTaskId: null, updatedAt: new Date().toISOString() };
  }

  private async save(context: WorkContextRecord): Promise<void> {
    await this.state.update((state) => {
      const index = state.workContexts.findIndex((item) => item.userId === context.userId);
      if (index >= 0) state.workContexts[index] = context;
      else state.workContexts.push(context);
    });
  }
}
