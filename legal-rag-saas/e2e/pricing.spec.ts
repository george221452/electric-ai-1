import { test, expect } from '@playwright/test';

test.describe('Pricing Page', () => {
  test('should display pricing cards', async ({ page }) => {
    await page.goto('/pricing');
    
    // Check title
    await expect(page.getByRole('heading', { name: /Prețuri/ })).toBeVisible();
    
    // Check pricing cards
    await expect(page.getByRole('heading', { name: 'Starter' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pro' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Enterprise' })).toBeVisible();
    
    // Check prices
    await expect(page.getByText('$29')).toBeVisible();
    await expect(page.getByText('$79')).toBeVisible();
    await expect(page.getByText('$199')).toBeVisible();
  });

  test('should have working navigation', async ({ page }) => {
    await page.goto('/pricing');
    
    // Check Logo link
    await page.getByRole('link', { name: 'LegalRAG' }).click();
    await expect(page).toHaveURL('/');
  });
});
