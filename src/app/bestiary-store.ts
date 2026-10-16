import type { WriteResult } from '../services/storage';

export interface BestiaryRepository {
  readBestiary(): string[];
  writeBestiary(value: string[]): WriteResult;
}

/** Owns the discovered-monster list: merging and persisting it. */
export class BestiaryStore {
  private kinds: string[];

  constructor(
    private readonly repository: BestiaryRepository,
    private readonly report: (result: WriteResult) => void,
  ) {
    this.kinds = repository.readBestiary();
  }

  get list(): string[] {
    return this.kinds;
  }

  /** Merge newly seen kinds into the list and persist it. */
  record(...discovered: string[]): void {
    this.kinds = [...new Set([...this.kinds, ...discovered])];
    this.report(this.repository.writeBestiary(this.kinds));
  }
}
