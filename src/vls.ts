export interface VlsCellLike {
  index: number;
  bank: "FWD" | "AFT";
}

export interface VlsGeometryConfig {
  columns: number;
  loadingPermutation: number;
  gridSize: number;
  isolationStartsAt: number;
  maximumIsolationFraction: number;
}

export function vlsCellDistance(a: number, b: number, columns: number) {
  if (a < 0 || b < 0) return Number.POSITIVE_INFINITY;
  return Math.max(
    Math.abs(Math.floor(a / columns) - Math.floor(b / columns)),
    Math.abs((a % columns) - (b % columns)),
  );
}

export function vlsLoadOrder<T extends VlsCellLike>(
  cells: T[],
  config: VlsGeometryConfig,
) {
  const bankOrder = (bank: T["bank"]) =>
    cells
      .filter((cell) => cell.bank === bank)
      .sort(
        (a, b) =>
          ((a.index * config.loadingPermutation) % config.gridSize) -
          ((b.index * config.loadingPermutation) % config.gridSize),
      );
  const forward = bankOrder("FWD"),
    aft = bankOrder("AFT"),
    order: T[] = [];
  for (let index = 0; index < Math.max(forward.length, aft.length); index++) {
    if (forward[index]) order.push(forward[index]);
    if (aft[index]) order.push(aft[index]);
  }
  return order;
}

export function allocateVlsLoadout(
  capacity: number,
  requestedMr: number,
  requestedEr: number,
) {
  const total = Math.max(0, requestedMr) + Math.max(0, requestedEr),
    scale = total > capacity ? capacity / total : 1;
  const mrTarget = Math.min(
    capacity,
    Math.floor(Math.max(0, requestedMr) * scale),
  );
  const erTarget = Math.min(
    capacity - mrTarget,
    Math.floor(Math.max(0, requestedEr) * scale),
  );
  const remainder = Math.min(
    capacity - mrTarget - erTarget,
    total > 0 ? Math.round(Math.min(capacity, total) - mrTarget - erTarget) : 0,
  );
  return {
    mr: mrTarget + (requestedMr >= requestedEr ? remainder : 0),
    er: erTarget + (requestedMr < requestedEr ? remainder : 0),
  };
}

export function desiredDisabledCells(
  cellCount: number,
  health: number,
  config: VlsGeometryConfig,
) {
  if (health <= 0.05) return cellCount;
  if (health >= config.isolationStartsAt) return 0;
  return Math.ceil(
    ((config.isolationStartsAt - health) / (config.isolationStartsAt - 0.05)) *
      cellCount *
      config.maximumIsolationFraction,
  );
}
