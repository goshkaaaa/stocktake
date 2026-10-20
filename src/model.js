export const emptyWorkspace = { version: 1, items: [], movements: [] };
export const units = ["pieces", "bottles", "packs", "rolls"];
function field(value, name, max = 160) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error(`${name} is required (up to ${max} characters).`);
  return value.trim();
}
function integer(value, name, min = 0) {
  if (!Number.isSafeInteger(value) || value < min || value > 1000000)
    throw new Error(
      `${name} must be a whole number between ${min} and 1,000,000.`,
    );
  return value;
}
export function balance(state, id) {
  return state.movements.reduce(
    (sum, movement) => sum + (movement.itemId === id ? movement.delta : 0),
    0,
  );
}
export function validate(state) {
  if (
    !state ||
    state.version !== 1 ||
    !Array.isArray(state.items) ||
    !Array.isArray(state.movements) ||
    state.items.length > 1000 ||
    state.movements.length > 20000
  )
    throw new Error("This is not a valid Stocktake backup.");
  const ids = new Set();
  const names = new Set();
  for (const item of state.items) {
    field(item.id, "ID", 100);
    field(item.name, "Item", 100);
    field(item.location, "Location", 150);
    integer(item.minimum, "Minimum");
    if (
      !units.includes(item.unit) ||
      ids.has(item.id) ||
      names.has(`${item.location}\0${item.name}`.toLowerCase())
    )
      throw new Error("Invalid or duplicate inventory item.");
    ids.add(item.id);
    names.add(`${item.location}\0${item.name}`.toLowerCase());
  }
  const movementIds = new Set();
  const balances = new Map();
  for (const movement of state.movements) {
    field(movement.id, "Movement ID", 100);
    if (
      !ids.has(movement.itemId) ||
      movementIds.has(movement.id) ||
      !Number.isSafeInteger(movement.delta) ||
      !movement.delta ||
      Math.abs(movement.delta) > 1000000 ||
      !Number.isFinite(movement.at) ||
      typeof movement.note !== "string" ||
      movement.note.length > 500
    )
      throw new Error("Invalid stock movement.");
    const next = (balances.get(movement.itemId) || 0) + movement.delta;
    if (next < 0 || next > 1000000)
      throw new Error("Stock movements would create an invalid balance.");
    balances.set(movement.itemId, next);
    movementIds.add(movement.id);
  }
  return state;
}
export function addItem(state, value, id = crypto.randomUUID()) {
  if (state.items.length >= 1000) throw new Error("The inventory is full.");
  const item = {
    id,
    name: field(value.name, "Item", 100),
    location: field(value.location, "Location", 150),
    unit: value.unit,
    minimum: integer(Number(value.minimum), "Minimum"),
  };
  if (!units.includes(item.unit)) throw new Error("Choose a unit.");
  if (
    state.items.some(
      (existing) =>
        existing.name.toLowerCase() === item.name.toLowerCase() &&
        existing.location.toLowerCase() === item.location.toLowerCase(),
    )
  )
    throw new Error("This item already exists at this location.");
  state.items.push(item);
  return state;
}
export function moveStock(
  state,
  value,
  now = Date.now(),
  id = crypto.randomUUID(),
) {
  if (!state.items.some((item) => item.id === value.itemId))
    throw new Error("Choose an inventory item.");
  if (state.movements.length >= 20000)
    throw new Error("The movement history is full. Export a backup.");
  const quantity = integer(Number(value.quantity), "Quantity", 1);
  if (!["in", "out"].includes(value.direction))
    throw new Error("Choose stock in or stock out.");
  const delta = value.direction === "in" ? quantity : -quantity;
  const next = balance(state, value.itemId) + delta;
  if (next < 0)
    throw new Error("There is not enough stock for this withdrawal.");
  if (next > 1000000) throw new Error("Stock cannot exceed 1,000,000 units.");
  state.movements.push({
    id,
    itemId: value.itemId,
    delta,
    note: String(value.note || "")
      .trim()
      .slice(0, 500),
    at: now,
  });
  return state;
}
export function restockList(state) {
  return state.items
    .map((item) => ({ ...item, stock: balance(state, item.id) }))
    .filter((item) => item.stock <= item.minimum)
    .map((item) => ({
      ...item,
      suggested: Math.max(1, item.minimum * 2 - item.stock),
    }));
}
export function csv(state) {
  const cell = (value) => {
    const text = String(value);
    return `"${(/^[\s]*[=+@-]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
  };
  return [
    ["Location", "Item", "Unit", "In stock", "Minimum", "Suggested order"],
    ...restockList(state).map((item) => [
      item.location,
      item.name,
      item.unit,
      item.stock,
      item.minimum,
      item.suggested,
    ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
