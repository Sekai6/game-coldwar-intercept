import type { EngagementSourceId } from "./engagement.js";

export type DefenseTargetEntry<TTarget> = readonly [
  EngagementSourceId,
  TTarget,
];

export interface DefenseTargetSource<TTarget> {
  readonly name: string;
  entries(): Iterable<DefenseTargetEntry<TTarget>>;
  observableEntries(): Iterable<DefenseTargetEntry<TTarget>>;
}

export type DefenseTargetSourceOptions<TTarget> = {
  observable?: (target: TTarget, id: EngagementSourceId) => boolean;
};

export function createDefenseTargetSource<TTarget>(
  name: string,
  entries: () => Iterable<DefenseTargetEntry<TTarget>>,
  options: DefenseTargetSourceOptions<TTarget> = {},
): DefenseTargetSource<TTarget> {
  return {
    name,
    entries,
    *observableEntries() {
      for (const entry of entries()) {
        if (!options.observable || options.observable(entry[1], entry[0]))
          yield entry;
      }
    },
  };
}

export class DefenseTargetRegistry<TTarget extends object> {
  private readonly sources = new Map<string, DefenseTargetSource<TTarget>>();

  register(source: DefenseTargetSource<TTarget>): () => void {
    if (this.sources.has(source.name))
      throw new Error(
        `Defense target source already registered: ${source.name}`,
      );
    this.sources.set(source.name, source);
    return () => this.sources.delete(source.name);
  }

  get(id: EngagementSourceId): TTarget | undefined {
    let selected: TTarget | undefined;
    let selectedSource = "";
    for (const source of this.sources.values()) {
      for (const [candidateId, target] of source.entries()) {
        if (candidateId !== id) continue;
        if (selected && selected !== target)
          throw new Error(
            `Duplicate defense target id ${String(id)} from ${selectedSource} and ${source.name}`,
          );
        selected = target;
        selectedSource = source.name;
      }
    }
    return selected;
  }

  idFor(target: TTarget): EngagementSourceId | undefined {
    let selected: EngagementSourceId | undefined;
    for (const source of this.sources.values()) {
      for (const [id, candidate] of source.entries()) {
        if (candidate !== target) continue;
        if (selected !== undefined && selected !== id)
          throw new Error(
            `Defense target appears with multiple ids: ${String(selected)} and ${String(id)}`,
          );
        selected = id;
      }
    }
    return selected;
  }

  entries(): DefenseTargetEntry<TTarget>[] {
    return this.collect(false);
  }

  observableEntries(): DefenseTargetEntry<TTarget>[] {
    return this.collect(true);
  }

  values(): TTarget[] {
    return this.entries().map((entry) => entry[1]);
  }

  private collect(observable: boolean): DefenseTargetEntry<TTarget>[] {
    const result: DefenseTargetEntry<TTarget>[] = [];
    const ids = new Map<EngagementSourceId, string>();
    for (const source of this.sources.values()) {
      const entries = observable
        ? source.observableEntries()
        : source.entries();
      for (const entry of entries) {
        const owner = ids.get(entry[0]);
        if (owner)
          throw new Error(
            `Duplicate defense target id ${String(entry[0])} from ${owner} and ${source.name}`,
          );
        ids.set(entry[0], source.name);
        result.push(entry);
      }
    }
    return result;
  }
}
