import { test, expect, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { LoginPage } from '../../src/pages/LoginPage';
import { InventoryPage } from '../../src/pages/InventoryPage';
import { CheckoutPage } from '../../src/pages/CheckoutPage';
import { users } from '../../src/data/users';
import { knownA11yIssues } from '../../src/data/a11yKnownIssues';

// Scan against WCAG 2.1 A and AA rules.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function scan(page: Page, pageName: string, testInfo: TestInfo) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

  // Attach the full axe output to the HTML report for whoever triages it.
  await testInfo.attach(`axe-${pageName}.json`, {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json',
  });

  const found = results.violations.map((v) => `${v.id} (${v.impact})`);
  const known = knownA11yIssues[pageName] ?? [];
  const unexpected = results.violations.filter((v) => !known.includes(v.id)).map((v) => v.id);
  const fixed = known.filter((id) => !results.violations.some((v) => v.id === id));

  testInfo.annotations.push({ type: 'axe violations', description: found.join(', ') || 'none' });
  if (fixed.length) {
    testInfo.annotations.push({ type: 'axe fixed', description: `No longer found, remove from baseline: ${fixed.join(', ')}` });
  }

  expect(unexpected, `New accessibility violations on the ${pageName} page`).toEqual([]);
}

test.describe('Accessibility', { tag: ['@ui', '@a11y'] }, () => {
  test('login page has no new WCAG violations', async ({ page }, testInfo) => {
    const login = new LoginPage(page);
    await login.goto();
    await scan(page, 'login', testInfo);
  });

  test('inventory page has no new WCAG violations', async ({ page }, testInfo) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(users.standard);
    await new InventoryPage(page).expectLoaded();
    await scan(page, 'inventory', testInfo);
  });

  test('checkout details page has no new WCAG violations', async ({ page }, testInfo) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(users.standard);
    const inventory = new InventoryPage(page);
    await inventory.expectLoaded();
    await inventory.addToCart('sauce-labs-backpack');
    await inventory.openCart();
    await new CheckoutPage(page).startFromCart();
    await expect(page.getByTestId('firstName')).toBeVisible();
    await scan(page, 'checkout', testInfo);
  });
});
