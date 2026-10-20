import { useEffect, useRef, useState } from "react";
import {
  addItem,
  balance,
  csv,
  emptyWorkspace,
  moveStock,
  restockList,
  units,
  validate,
} from "./model";
import { change, download, read } from "./repository";

export default function App() {
  const [state, setState] = useState(emptyWorkspace);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("inventory");
  const [location, setLocation] = useState("all");
  const [query, setQuery] = useState("");
  const [itemId, setItemId] = useState("");
  const [consent, setConsent] = useState(false);
  const [previous, setPrevious] = useState(null);
  const channel = useRef(null);
  useEffect(() => {
    let cancelled = false;
    read()
      .then((value) => {
        if (!cancelled) {
          setState(value);
          setReady(true);
        }
      })
      .catch(() =>
        setMessage(
          "Browser storage is unavailable. Enable IndexedDB to use Stocktake.",
        ),
      );
    const broadcast = new BroadcastChannel("stocktake-updates");
    channel.current = broadcast;
    broadcast.onmessage = () =>
      read()
        .then(setState)
        .catch((error) => setMessage(error.message));
    return () => {
      cancelled = true;
      broadcast.close();
    };
  }, []);
  async function mutate(action, success) {
    setBusy(true);
    try {
      const next = await change(action);
      setState(next);
      channel.current?.postMessage("updated");
      setMessage(success);
      return true;
    } catch (error) {
      setMessage(error.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function submit(event, type) {
    event.preventDefault();
    const form = event.currentTarget;
    const value = Object.fromEntries(new FormData(form));
    if (
      await mutate(
        (current) =>
          type === "item" ? addItem(current, value) : moveStock(current, value),
        type === "item"
          ? "Item registered. Record a delivery to add stock."
          : "Stock movement recorded.",
      )
    ) {
      form.reset();
      setTab("inventory");
    }
  }
  async function restore(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (!consent)
        throw new Error("Tick the replacement checkbox before restoring.");
      if (file.size > 10000000)
        throw new Error("Use a backup smaller than 10 MB.");
      const incoming = validate(JSON.parse(await file.text()));
      setPrevious(structuredClone(state));
      if (
        await mutate(
          () => incoming,
          "Backup restored. You can undo this replacement until the page is closed.",
        )
      )
        setConsent(false);
    } catch (error) {
      setMessage(error.message);
    } finally {
      event.target.value = "";
    }
  }
  const locations = [
    ...new Set(state.items.map((item) => item.location)),
  ].sort();
  const shopping = restockList(state);
  const visible = state.items.filter(
    (item) =>
      (location === "all" || item.location === location) &&
      `${item.name} ${item.location}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const blocked = !ready || busy;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#main">
          <span>▣</span>stocktake.
        </a>
        <p className="sidebar-label">THE SUPPLY DESK</p>
        <nav aria-label="Workspace">
          {[
            ["inventory", "Inventory"],
            ["movement", "Record movement"],
            ["add", "Register item"],
            ["restock", "Restock list"],
            ["history", "Movement history"],
            ["backups", "Backups"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
            >
              {label}
              {value === "restock" ? <span>{shopping.length}</span> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span>
            READY FOR
            <br />
            THE NEXT JOB.
          </span>
          <p>
            Real stock. Clear movements.
            <br />A cupboard that stays ready.
          </p>
          <a href="https://github.com/goshkaaaa/stocktake">View source ↗</a>
        </div>
      </aside>
      <main id="main">
        <header>
          <span>OPERATIONS / SUPPLIES</span>
          <span>Saved in this browser</span>
        </header>
        <section className="heading">
          <div>
            <p className="eyebrow">A LITTLE ORDER GOES A LONG WAY</p>
            <h1>
              {
                {
                  inventory: "Keep the cupboard ready.",
                  movement: "Every move, recorded.",
                  add: "A place for the essentials.",
                  restock: "Before you run out.",
                  history: "Follow the supplies.",
                  backups: "A copy you can keep.",
                }[tab]
              }
            </h1>
          </div>
          {tab === "inventory" ? (
            <button
              className="primary"
              disabled={blocked}
              onClick={() => setTab("movement")}
            >
              Record movement +
            </button>
          ) : null}
        </section>
        <div className="stats">
          <div>
            <span>ITEMS TRACKED</span>
            <strong>{state.items.length}</strong>
          </div>
          <div>
            <span>STORAGE LOCATIONS</span>
            <strong>{locations.length}</strong>
          </div>
          <div className={shopping.length ? "needs-attention" : ""}>
            <span>NEED A RESTOCK</span>
            <strong>{shopping.length}</strong>
          </div>
        </div>
        <p className="notice" role="status">
          {message}
        </p>
        {tab === "inventory" ? (
          <section>
            <div className="toolbar">
              <label>
                <span className="sr-only">Filter location</span>
                <select
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                >
                  <option value="all">All locations</option>
                  {locations.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Search inventory</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find an item…"
                />
              </label>
            </div>
            {!state.items.length ? (
              <div className="empty">
                <span>▣</span>
                <h2>A clear shelf is a good start.</h2>
                <p>
                  Register an item and its location, then record the supplies
                  you have.
                </p>
                <button
                  className="primary"
                  disabled={blocked}
                  onClick={() => setTab("add")}
                >
                  Register your first item +
                </button>
              </div>
            ) : null}
            <div className="inventory-grid">
              {visible.map((item) => {
                const count = balance(state, item.id);
                return (
                  <article key={item.id} className="stock-card">
                    <div>
                      <span className="location-tag">{item.location}</span>
                      <span
                        className={`badge ${count <= item.minimum ? "low" : ""}`}
                      >
                        {count <= item.minimum ? "RESTOCK" : "READY"}
                      </span>
                    </div>
                    <h2>{item.name}</h2>
                    <div className="stock-count">
                      {count}
                      <span>{item.unit}</span>
                    </div>
                    <div className="stock-meter">
                      <span
                        style={{
                          width: `${Math.min(100, (count / Math.max(1, item.minimum * 2)) * 100)}%`,
                        }}
                      />
                    </div>
                    <p>
                      Restock at {item.minimum} {item.unit} or below
                    </p>
                    <button
                      disabled={blocked}
                      onClick={() => {
                        setItemId(item.id);
                        setTab("movement");
                      }}
                    >
                      Record in / out ↗
                    </button>
                  </article>
                );
              })}
            </div>
            {state.items.length && !visible.length ? (
              <p className="empty">No items match this filter.</p>
            ) : null}
          </section>
        ) : null}
        {tab === "add" ? (
          <section className="form-layout">
            <div>
              <h2>Start with the label.</h2>
              <p>
                Keep one record per item and storage location. The opening
                balance is zero; deliveries create stock.
              </p>
            </div>
            <form onSubmit={(event) => submit(event, "item")}>
              <label>
                Item name
                <input
                  name="name"
                  maxLength={100}
                  required
                  placeholder="Glass cleaner"
                />
              </label>
              <label>
                Storage location
                <input
                  name="location"
                  maxLength={150}
                  required
                  placeholder="Main store or apartment reference"
                  list="locations"
                />
                <datalist id="locations">
                  {locations.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
              </label>
              <div className="form-row">
                <label>
                  Unit
                  <select name="unit" aria-label="Unit">
                    {units.map((unit) => (
                      <option key={unit}>{unit}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Minimum stock
                  <input
                    name="minimum"
                    type="number"
                    min="0"
                    max="1000000"
                    step="1"
                    defaultValue="2"
                    required
                  />
                </label>
              </div>
              <button className="primary" disabled={blocked}>
                Register item +
              </button>
            </form>
          </section>
        ) : null}
        {tab === "movement" ? (
          <section className="form-layout">
            <div>
              <h2>
                From delivery
                <br />
                to daily use.
              </h2>
              <p>
                Stock is calculated from movements. Withdrawals cannot take the
                balance below zero.
              </p>
            </div>
            {state.items.length ? (
              <form onSubmit={(event) => submit(event, "movement")}>
                <label>
                  Inventory item
                  <select
                    name="itemId"
                    value={itemId}
                    onChange={(event) => setItemId(event.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Choose an item
                    </option>
                    {state.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.location}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-row">
                  <label>
                    Direction
                    <select name="direction" aria-label="Direction">
                      <option value="in">Stock in · received</option>
                      <option value="out">Stock out · used</option>
                    </select>
                  </label>
                  <label>
                    Quantity
                    <input
                      name="quantity"
                      type="number"
                      min="1"
                      max="1000000"
                      step="1"
                      required
                    />
                  </label>
                </div>
                <label>
                  Movement note
                  <textarea
                    name="note"
                    maxLength={500}
                    placeholder="Delivery, job reference, or reason"
                  />
                </label>
                <button className="primary" disabled={blocked}>
                  Record movement ↗
                </button>
              </form>
            ) : (
              <p className="empty">Register an item first.</p>
            )}
          </section>
        ) : null}
        {tab === "restock" ? (
          <section className="restock">
            <div className="section-heading">
              <h2>The next supply run.</h2>
              <div>
                <button
                  className="outline"
                  onClick={() =>
                    download("stocktake-restock.csv", csv(state), "text/csv")
                  }
                >
                  Export CSV ↓
                </button>
                <button className="outline" onClick={() => window.print()}>
                  Print list ↗
                </button>
              </div>
            </div>
            <p className="muted">
              Suggested quantities bring stock back to twice the minimum level,
              with at least one unit ordered.
            </p>
            {!shopping.length ? (
              <div className="empty">
                <h2>Nothing on the list.</h2>
                <p>Items appear here when stock reaches their minimum level.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Location</th>
                      <th>On shelf</th>
                      <th>Suggested order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shopping.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{item.location}</td>
                        <td>
                          {item.stock} {item.unit}
                        </td>
                        <td>
                          {item.suggested} {item.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}
        {tab === "history" ? (
          <section className="history">
            <h2>The movement log.</h2>
            {!state.movements.length ? (
              <p className="empty">
                Your first stock movement will appear here.
              </p>
            ) : null}
            {[...state.movements].reverse().map((movement) => {
              const item = state.items.find(
                (item) => item.id === movement.itemId,
              );
              return (
                <article key={movement.id}>
                  <span className={`delta ${movement.delta < 0 ? "out" : ""}`}>
                    {movement.delta > 0 ? "+" : ""}
                    {movement.delta}
                  </span>
                  <div>
                    <h3>{item?.name}</h3>
                    <p>
                      {item?.location} ·{" "}
                      {new Date(movement.at).toLocaleString()}
                    </p>
                    <small>{movement.note}</small>
                  </div>
                  <span>{item?.unit}</span>
                </article>
              );
            })}
          </section>
        ) : null}
        {tab === "backups" ? (
          <section className="backup-panel">
            <h2>Your shelf, backed up.</h2>
            <p>
              Keep a copy outside this browser. Restoring replaces the current
              inventory and its movement history.
            </p>
            <button
              className="primary"
              disabled={!ready}
              onClick={() =>
                download(
                  "stocktake-backup.json",
                  JSON.stringify(state, null, 2),
                  "application/json",
                )
              }
            >
              Export backup ↓
            </button>
            <label className="consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />
              I want to replace the current inventory with a backup.
            </label>
            <input
              type="file"
              accept=".json,application/json"
              aria-label="Restore Stocktake backup"
              disabled={!consent || busy}
              onChange={restore}
            />
            {previous ? (
              <button
                className="outline"
                onClick={async () => {
                  if (
                    await mutate(() => previous, "Previous inventory restored.")
                  )
                    setPrevious(null);
                }}
              >
                Undo replacement ↶
              </button>
            ) : null}
          </section>
        ) : null}
        <footer>
          <span>stocktake.</span>
          <span>Stored on this device. Backups travel with you.</span>
        </footer>
      </main>
    </div>
  );
}
