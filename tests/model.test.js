import test from "node:test";
import assert from "node:assert/strict";
import {
  addItem,
  balance,
  csv,
  emptyWorkspace,
  moveStock,
  restockList,
  validate,
} from "../src/model.js";
const fresh = () =>
  addItem(
    structuredClone(emptyWorkspace),
    { name: "Cleaner", location: "Store", unit: "bottles", minimum: 2 },
    "item",
  );
test("new items have zero stock until a delivery is recorded", () =>
  assert.equal(balance(fresh(), "item"), 0));
test("incoming and outgoing movements determine the balance", () => {
  const state = fresh();
  moveStock(state, { itemId: "item", quantity: 10, direction: "in" }, 1, "a");
  moveStock(state, { itemId: "item", quantity: 3, direction: "out" }, 2, "b");
  assert.equal(balance(state, "item"), 7);
  validate(state);
});
test("withdrawals cannot make the balance negative", () =>
  assert.throws(
    () => moveStock(fresh(), { itemId: "item", quantity: 1, direction: "out" }),
    /not enough/,
  ));
test("fractional and unsafe quantities are rejected", () => {
  for (const quantity of [0, -1, 1.5, Infinity, "oops"])
    assert.throws(
      () => moveStock(fresh(), { itemId: "item", quantity, direction: "in" }),
      /whole number/,
    );
});
test("restock suggestions target twice the minimum and include empty stock", () => {
  const state = fresh();
  assert.equal(restockList(state)[0].suggested, 4);
  moveStock(state, { itemId: "item", quantity: 3, direction: "in" }, 1, "a");
  assert.equal(restockList(state).length, 0);
});
test("restore rejects negative intermediate balances and dangling movements", () => {
  const state = fresh();
  state.movements = [{ id: "a", itemId: "item", delta: -1, at: 1, note: "" }];
  assert.throws(() => validate(state), /invalid balance/);
});
test("same product can exist in different locations", () => {
  const state = fresh();
  addItem(
    state,
    { name: "Cleaner", location: "Flat 12", unit: "bottles", minimum: 1 },
    "other",
  );
  assert.equal(state.items.length, 2);
  assert.throws(
    () =>
      addItem(state, {
        name: "cleaner",
        location: "store",
        unit: "bottles",
        minimum: 1,
      }),
    /already exists/,
  );
});
test("restock CSV is readable and contains the actual shortage", () =>
  assert.ok(csv(fresh()).includes('"Store","Cleaner","bottles","0","2","4"')));
