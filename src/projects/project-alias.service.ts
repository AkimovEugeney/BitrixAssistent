import { Injectable, NotFoundException } from '@nestjs/common';
import { BitrixClientProvider } from '../bitrix/bitrix-client.provider';
import { LocalStateService, ProjectAliasRecord } from '../storage/local-state.service';

@Injectable()
export class ProjectAliasService {
  constructor(
    private readonly state: LocalStateService,
    private readonly bitrixClients: BitrixClientProvider,
  ) {}

  async list(): Promise<ProjectAliasRecord[]> {
    return (await this.state.read()).projectAliases;
  }

  async getRequired(alias: string): Promise<ProjectAliasRecord> {
    const normalized = this.normalize(alias);
    const record = (await this.list()).find((item) => item.alias === normalized);
    if (!record) throw new NotFoundException(`Project alias "${normalized}" is not configured.`);
    return record;
  }

  async findByGroupId(groupId: number): Promise<ProjectAliasRecord | undefined> {
    return (await this.list()).find((item) => item.bitrixGroupId === groupId);
  }

  async bind(userId: string, alias: string, bitrixGroupId: number): Promise<ProjectAliasRecord> {
    const normalized = this.normalize(alias);
    const group = await this.bitrixClients.getClient(userId).getWorkgroup(bitrixGroupId);
    const now = new Date().toISOString();
    const result: ProjectAliasRecord = {
      id: normalized,
      alias: normalized,
      bitrixGroupId,
      bitrixTitle: group.title,
      createdAt: now,
      updatedAt: now,
    };

    await this.state.update((state) => {
      const index = state.projectAliases.findIndex((item) => item.alias === normalized);
      if (index >= 0) result.createdAt = state.projectAliases[index].createdAt;
      if (index >= 0) state.projectAliases[index] = result;
      else state.projectAliases.push(result);
    });
    return result;
  }

  private normalize(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (!normalized) throw new NotFoundException('Project alias cannot be empty.');
    return normalized;
  }
}
