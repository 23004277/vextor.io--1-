import { EntityType } from '../types';

export interface ECSComponentMap {
  [key: string]: unknown;
}

export interface CreateEntityOptions {
  tags?: string[];
}

export interface ECSEntityRecord {
  id: number;
  type: EntityType;
  active: boolean;
  components: ECSComponentMap;
}

export class EntityManager {
  private entities: Map<number, ECSEntityRecord> = new Map();
  private activeIds: number[] = [];
  private readonly scratchActive: ECSEntityRecord[] = [];
  private readonly scratchQuery: ECSEntityRecord[] = [];

  create(id: number, type: EntityType, components: ECSComponentMap = {}, options: CreateEntityOptions = {}): ECSEntityRecord {
    const normalized = this.withNormalizedTags(type, components, options.tags);
    const record: ECSEntityRecord = { id, type, active: true, components: normalized };
    this.entities.set(id, record);
    this.activeIds.push(id);
    return record;
  }

  private withNormalizedTags(type: EntityType, components: ECSComponentMap, explicitTags: string[] = []): ECSComponentMap {
    const existing = Array.isArray(components.tags) ? (components.tags as string[]) : [];
    const tags = new Set<string>([...existing, ...explicitTags].map(t => String(t).toLowerCase()));
    if (type === EntityType.DRONE) tags.add('drone');
    if (type === EntityType.MINI_TANK) tags.add('minion');
    return { ...components, tags: Array.from(tags) };
  }

  destroy(id: number): void {
    const rec = this.entities.get(id);
    if (!rec) return;
    rec.active = false;
    this.entities.delete(id);
    const idx = this.activeIds.indexOf(id);
    if (idx >= 0) this.activeIds.splice(idx, 1);
  }

  get(id: number): ECSEntityRecord | undefined {
    return this.entities.get(id);
  }

  getActive(): ECSEntityRecord[] {
    const result = this.scratchActive;
    result.length = 0;
    for (let i = 0; i < this.activeIds.length; i++) {
      const rec = this.entities.get(this.activeIds[i]);
      if (rec && rec.active) result.push(rec);
    }
    // Preserve compatibility: callers can retain the returned array.
    return result.slice();
  }

  queryByComponent(componentKey: string): ECSEntityRecord[] {
    const result = this.scratchQuery;
    result.length = 0;
    this.queryByComponentInto(componentKey, result);
    return result.slice();
  }

  queryByComponentInto(componentKey: string, out: ECSEntityRecord[]): ECSEntityRecord[] {
    out.length = 0;
    for (let i = 0; i < this.activeIds.length; i++) {
      const rec = this.entities.get(this.activeIds[i]);
      if (!rec || !rec.active) continue;
      if (componentKey in rec.components) out.push(rec);
    }
    return out;
  }

  queryByComponentsInto(componentKeys: string[], out: ECSEntityRecord[]): ECSEntityRecord[] {
    out.length = 0;
    for (let i = 0; i < this.activeIds.length; i++) {
      const rec = this.entities.get(this.activeIds[i]);
      if (!rec || !rec.active) continue;
      let matches = true;
      for (let j = 0; j < componentKeys.length; j++) {
        if (!(componentKeys[j] in rec.components)) {
          matches = false;
          break;
        }
      }
      if (matches) out.push(rec);
    }
    return out;
  }

  forEachActive(fn: (record: ECSEntityRecord) => void): void {
    for (let i = 0; i < this.activeIds.length; i++) {
      const rec = this.entities.get(this.activeIds[i]);
      if (rec && rec.active) fn(rec);
    }
  }

  queryWhereInto(predicate: (record: ECSEntityRecord) => boolean, out: ECSEntityRecord[]): ECSEntityRecord[] {
    out.length = 0;
    for (let i = 0; i < this.activeIds.length; i++) {
      const rec = this.entities.get(this.activeIds[i]);
      if (!rec || !rec.active) continue;
      if (predicate(rec)) out.push(rec);
    }
    return out;
  }

  clear(): void {
    this.entities.clear();
    this.activeIds.length = 0;
  }
}
