import type { Container, ContainerChild } from 'pixi.js';
import { EntityManager } from '../services/EntityManager';

type RenderLayerName =
  | 'background'
  | 'shapes'
  | 'projectiles'
  | 'units'
  | 'overlays'
  | 'ui';

type LayerMap = Record<RenderLayerName, Container>;

type RenderDisplayObject = ContainerChild;

type RenderBinding = {
  id: number;
  display: RenderDisplayObject;
  layer: RenderLayerName;
  zBias: number;
};

type RenderMetrics = {
  activeBindings: number;
  hiddenBindings: number;
  layerCounts: Record<RenderLayerName, number>;
};

export class RenderSystem {
  private readonly layers: LayerMap;
  private readonly bindings = new Map<number, RenderBinding>();
  private readonly metrics: RenderMetrics = {
    activeBindings: 0,
    hiddenBindings: 0,
    layerCounts: {
      background: 0,
      shapes: 0,
      projectiles: 0,
      units: 0,
      overlays: 0,
      ui: 0,
    },
  };

  constructor(private readonly stage: Container) {
    this.layers = {
      background: this.makeLayer('background', false),
      shapes: this.makeLayer('shapes', true),
      projectiles: this.makeLayer('projectiles', true),
      units: this.makeLayer('units', true),
      overlays: this.makeLayer('overlays', false),
      ui: this.makeLayer('ui', false),
    };

    this.stage.sortableChildren = true;
    this.stage.addChild(
      this.layers.background,
      this.layers.shapes,
      this.layers.projectiles,
      this.layers.units,
      this.layers.overlays,
      this.layers.ui
    );
  }

  private makeLayer(name: RenderLayerName, sortable: boolean): Container {
    const layer = new (this.stage.constructor as new () => Container)();
    layer.name = `layer:${name}`;
    layer.sortableChildren = sortable;
    return layer;
  }

  registerEntityDisplay(
    id: number,
    display: RenderDisplayObject,
    layer: RenderLayerName = 'units',
    zBias = 0
  ): void {
    this.unregisterEntityDisplay(id);

    const targetLayer = this.layers[layer];
    display.zIndex = zBias;
    targetLayer.addChild(display);
    this.bindings.set(id, { id, display, layer, zBias });
  }

  unregisterEntityDisplay(id: number): void {
    const existing = this.bindings.get(id);
    if (!existing) return;
    const parent = existing.display.parent;
    if (parent) parent.removeChild(existing.display);
    this.bindings.delete(id);
  }

  setLayerVisibility(layer: RenderLayerName, visible: boolean): void {
    this.layers[layer].visible = visible;
  }

  setEntityVisible(id: number, visible: boolean): void {
    const binding = this.bindings.get(id);
    if (!binding) return;
    binding.display.visible = visible;
  }

  setEntityAlpha(id: number, alpha: number): void {
    const binding = this.bindings.get(id);
    if (!binding) return;
    binding.display.alpha = Math.max(0, Math.min(1, alpha));
  }

  setEntityZBias(id: number, zBias: number): void {
    const binding = this.bindings.get(id);
    if (!binding) return;
    binding.zBias = zBias;
    binding.display.zIndex = zBias;
  }

  rebindEntityLayer(id: number, nextLayer: RenderLayerName): void {
    const binding = this.bindings.get(id);
    if (!binding || binding.layer === nextLayer) return;
    const prevParent = binding.display.parent;
    if (prevParent) prevParent.removeChild(binding.display);
    this.layers[nextLayer].addChild(binding.display);
    binding.layer = nextLayer;
  }

  getMetrics(): RenderMetrics {
    return {
      activeBindings: this.metrics.activeBindings,
      hiddenBindings: this.metrics.hiddenBindings,
      layerCounts: { ...this.metrics.layerCounts },
    };
  }

  update(_dt: number, _entities: EntityManager): void {
    // ECS migration note:
    // This system currently orchestrates Pixi display objects registered by id.
    // EntityManager can later provide position/visibility data for direct sync here.
    this.metrics.activeBindings = this.bindings.size;
    this.metrics.hiddenBindings = 0;
    this.metrics.layerCounts.background = 0;
    this.metrics.layerCounts.shapes = 0;
    this.metrics.layerCounts.projectiles = 0;
    this.metrics.layerCounts.units = 0;
    this.metrics.layerCounts.overlays = 0;
    this.metrics.layerCounts.ui = 0;

    for (const binding of this.bindings.values()) {
      this.metrics.layerCounts[binding.layer]++;
      if (!binding.display.visible) this.metrics.hiddenBindings++;
    }

    // Sort only sortable layers to avoid unnecessary work.
    this.layers.shapes.sortChildren();
    this.layers.projectiles.sortChildren();
    this.layers.units.sortChildren();
  }

  destroy(): void {
    for (const binding of this.bindings.values()) {
      const parent = binding.display.parent;
      if (parent) parent.removeChild(binding.display);
    }
    this.bindings.clear();
    this.stage.removeChild(
      this.layers.background,
      this.layers.shapes,
      this.layers.projectiles,
      this.layers.units,
      this.layers.overlays,
      this.layers.ui
    );
  }
}
