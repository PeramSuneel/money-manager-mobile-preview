import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = process.cwd();
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = resolve(root, relative);
    if (file !== root && !file.startsWith(root + sep)) throw new Error('Invalid path');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
await new Promise(resolve => server.listen(4173, '127.0.0.1', resolve));

const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.locator('#heroNetWorth').waitFor();

  const order = await page.evaluate(() => {
    const top = selector => document.querySelector(selector).getBoundingClientRect().top;
    return {
      rates: top('#dashboardMetals'),
      metrics: top('.dashboard-metrics'),
      recent: top('.lower-grid'),
      charts: top('#page-dashboard > .content-grid:not(.lower-grid)')
    };
  });
  if (!(order.rates < order.metrics && order.metrics < order.recent && order.recent < order.charts)) {
    throw new Error('Dashboard sections are not in the requested order: ' + JSON.stringify(order));
  }
  const columns = await page.locator('.dashboard-metrics').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  if (columns !== 3) throw new Error('Dashboard income/spending/EMI cards are not in one row on mobile.');
  if (!(await page.locator('#dashboardMetals').innerText()).includes('Gold & Silver Rates - Today')) {
    throw new Error('Dashboard rates heading is missing.');
  }

  await page.locator('#menuToggle').click();
  await page.locator('#nav [data-page="transactions"]').click();
  await page.locator('#txAdd').click();
  const type = page.locator('#formFields [name="type"]');
  const labels = await type.locator('option').allTextContents();
  if (!labels.includes('Spending')) throw new Error('Transaction type does not show Spending.');
  if (await type.locator('option').first().getAttribute('value') !== 'Expense') {
    throw new Error('Spending display label must retain the existing Expense data value.');
  }
  const categoryList = page.locator('#suggestions-category');
  const paidViaList = page.locator('#suggestions-account');
  const categoryOptions = await categoryList.locator('option').evaluateAll(nodes => nodes.map(n => n.value));
  const paidViaOptions = await paidViaList.locator('option').evaluateAll(nodes => nodes.map(n => n.value));
  if (!categoryOptions.includes('Food')) throw new Error('Category suggestions are missing.');
  if (!paidViaOptions.includes('UPI')) throw new Error('Paid via suggestions are missing.');

  await type.selectOption('Income');
  const incomeOptions = await categoryList.locator('option').evaluateAll(nodes => nodes.map(n => n.value));
  if (!incomeOptions.includes('Salary')) throw new Error('Category suggestions did not update for Income.');
  await type.selectOption('Expense');
  await page.locator('#formFields [name="date"]').fill('2026-11-06');
  await page.locator('#formFields [name="description"]').fill('Preview smoke test');
  await page.locator('#formFields [name="category"]').fill('Custom category');
  await page.locator('#formFields [name="account"]').fill('Custom payment');
  await page.locator('#formFields [name="amount"]').fill('125');
  await page.locator('#recordForm button[type="submit"]').click();
  await page.locator('#modal.open').waitFor({ state: 'detached', timeout: 3000 }).catch(async () => {
    if (await page.locator('#modal').getAttribute('aria-hidden') !== 'true') throw new Error('Transaction form did not close after saving.');
  });
  const transactionText = await page.locator('#txTable').innerText();
  if (!transactionText.includes('Spending') || !transactionText.includes('Custom category') || !transactionText.includes('Custom payment')) {
    throw new Error('Saved transaction did not preserve custom category/payment or Spending label.');
  }
  if (errors.length) throw new Error('Browser errors: ' + errors.join(' | '));
  console.log('PASS: mobile dashboard order, compact metrics, gold/silver heading, editable suggestions, dynamic category options, custom values, and Spending terminology.');
} finally {
  await browser.close();
  server.close();
}
