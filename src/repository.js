import { openDB } from "idb";
import { emptyWorkspace, validate } from "./model.js";
const database = () =>
  openDB("stocktake-workspace", 1, {
    upgrade(db) {
      db.createObjectStore("state");
    },
  });
export async function read() {
  const db = await database();
  return validate(
    (await db.get("state", "workspace")) || structuredClone(emptyWorkspace),
  );
}
export async function change(action) {
  const db = await database();
  const tx = db.transaction("state", "readwrite");
  try {
    const current = validate(
      (await tx.store.get("workspace")) || structuredClone(emptyWorkspace),
    );
    const next = validate(action(current));
    await tx.store.put(next, "workspace");
    await tx.done;
    return next;
  } catch (error) {
    tx.abort();
    await tx.done.catch(() => {});
    throw error;
  }
}
export function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
