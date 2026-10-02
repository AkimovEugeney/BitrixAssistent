import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BitrixClientProvider } from '../bitrix/bitrix-client.provider';
import { BitrixTask, BitrixTaskListItem } from '../bitrix/task.dto';
import { ProjectAliasService } from '../projects/project-alias.service';
import { WorkContextService } from '../work-context/work-context.service';

const DEFAULT_USER_ID = 'default';

@Injectable()
export class TaskApplicationService {
  constructor(
    private readonly clients: BitrixClientProvider,
    private readonly projects: ProjectAliasService,
    private readonly contexts: WorkContextService,
  ) {}

  async getProjectTasks(projectAlias: string): Promise<{ project: { alias: string; bitrixGroupId: number; title: string | null }; tasks: BitrixTaskListItem[] }> {
    const project = await this.projects.getRequired(projectAlias);
    const tasks = await this.clients.getClient(DEFAULT_USER_ID).getOpenGroupTasks(project.bitrixGroupId);
    return { project: { alias: project.alias, bitrixGroupId: project.bitrixGroupId, title: project.bitrixTitle }, tasks };
  }

  async selectTask(taskId: number): Promise<BitrixTask> {
    const task = await this.clients.getClient(DEFAULT_USER_ID).getTask(taskId);
    const project = task.groupId ? await this.projects.findByGroupId(task.groupId) : undefined;
    await this.contexts.setTask(DEFAULT_USER_ID, task.id, project?.alias ?? null);
    return task;
  }

  async addElapsedTime(taskId: number | undefined, seconds: number, description: string): Promise<{ success: true; taskId: number; seconds: number; description: string }> {
    if (seconds <= 0) throw new BadRequestException('Time must be greater than zero seconds.');
    if (!description.trim()) throw new BadRequestException('A work description is required.');
    const context = await this.contexts.get(DEFAULT_USER_ID);
    const selectedTaskId = taskId ?? context.currentTaskId;
    if (!selectedTaskId) throw new NotFoundException('No current task is selected. Ask the user to choose a task first.');
    await this.clients.getClient(DEFAULT_USER_ID).getTask(selectedTaskId);
    await this.clients.getClient(DEFAULT_USER_ID).addElapsedTime(selectedTaskId, seconds, description.trim());
    return { success: true, taskId: selectedTaskId, seconds, description: description.trim() };
  }

  getContext() { return this.contexts.get(DEFAULT_USER_ID); }
  clearCurrentTask() { return this.contexts.clearTask(DEFAULT_USER_ID); }
  bindProjectAlias(alias: string, bitrixGroupId: number) { return this.projects.bind(DEFAULT_USER_ID, alias, bitrixGroupId); }
  getProjectAliases() { return this.projects.list(); }
}
