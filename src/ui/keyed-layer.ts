/**
 * Reuses one DOM node per keyed item across frames: creates nodes for new keys,
 * updates every live node, and removes nodes whose keys disappeared.
 */
export class KeyedLayer<T, N extends Element = SVGElement> {
  private readonly nodes = new Map<number, N>();

  constructor(
    private readonly options: {
      key: (item: T) => number;
      create: (item: T) => N;
      update: (node: N, item: T) => void;
      /** Return true when an existing node no longer fits its item and must be rebuilt. */
      stale?: (node: N, item: T) => boolean;
    },
  ) {}

  sync(items: readonly T[], host: Element): void {
    const live = new Set<number>();
    for (const item of items) {
      const key = this.options.key(item);
      live.add(key);
      let node = this.nodes.get(key);
      if (node && this.options.stale?.(node, item)) {
        node.remove();
        node = undefined;
      }
      if (!node) {
        node = this.options.create(item);
        this.nodes.set(key, node);
        host.append(node);
      }
      this.options.update(node, item);
    }
    for (const [key, node] of this.nodes)
      if (!live.has(key)) {
        node.remove();
        this.nodes.delete(key);
      }
  }

  /** Forgets every node, for when the host markup is replaced wholesale. */
  clear(): void {
    this.nodes.clear();
  }
}
