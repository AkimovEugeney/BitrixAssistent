import { Injectable } from '@nestjs/common';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export type ProjectAliasRecord = {
  id: string;
  alias: string;
  bitrixGroupId: number;
  bitrixTitle: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkContextRecord = {
  id: string;
  userId: string;
  currentProjectAlias: string | null;
  currentTaskId: number | null;
  updatedAt: string;
};

type State = { projectAliases: ProjectAliasRecord[]; workContexts: WorkContextRecord[] };
const emptyState = (): State => ({ projectAliases: [], workContexts: [] });

@Injectable()
export class LocalStateService {
  private readonly filePath = join(process.env.DATA_DIR ?? join(process.cwd(), 'data'), 'state.json');

  async read(): Promise<State> {
    try {
      const raw: unknown = JSON.parse(await readFile(this.filePath, 'utf8'));
      if (!this.isState(raw)) return emptyState();
      return raw;
    } catch (error: unknown) {
      if (this.isNotFound(error)) return emptyState();
      throw error;
    }
  }

  async update(mutator: (state: State) => void): Promise<void> {
    const state = await this.read();
    mutator(state);
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(state, null, 2), 'utf8');
    await rename(temporaryPath, this.filePath);
  }

  private isNotFound(error: unknown): error is NodeJS.ErrnoException {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
  }

  private isState(value: unknown): value is State {
    return typeof value === 'object' && value !== null && 'projectAliases' in value && 'workContexts' in value
      && Array.isArray(value.projectAliases) && Array.isArray(value.workContexts);
  }
}
