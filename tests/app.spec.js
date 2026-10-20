import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("deliveries, withdrawals, and restock quantities survive a reload", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Register your first item +" })
    .click();
  await page.getByLabel("Item name", { exact: true }).fill("Glass cleaner");
  await page.getByLabel("Storage location", { exact: true }).fill("Main store");
  await page.getByLabel("Unit", { exact: true }).selectOption("bottles");
  await page
    .getByRole("button", { name: "Register item +", exact: true })
    .click();
  await page.getByRole("button", { name: "Record in / out ↗" }).click();
  await page.getByLabel("Quantity", { exact: true }).fill("5");
  await page
    .getByRole("button", { name: "Record movement ↗", exact: true })
    .click();
  await expect(page.locator(".stock-count")).toContainText("5");
  await page.getByRole("button", { name: "Record in / out ↗" }).click();
  await page.getByLabel("Direction", { exact: true }).selectOption("out");
  await page.getByLabel("Quantity", { exact: true }).fill("4");
  await page
    .getByRole("button", { name: "Record movement ↗", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".stock-count")).toContainText("1");
  await expect(page.locator(".stock-card .badge")).toHaveText("RESTOCK");
  await page.getByRole("button", { name: /Restock list/ }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText("3 bottles");
});
test("empty data and a portable backup are real", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".stock-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Backups", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup ↓" }).click();
  expect((await pending).suggestedFilename()).toBe("stocktake-backup.json");
});
test("inventory fits mobile screens and passes accessibility checks", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Register your first item +" }),
  ).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((item) => ({
      id: item.id,
      targets: item.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
});
