import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should display homepage correctly', async ({ page }) => {
    await page.goto('/');
    
    // Check title
    await expect(page).toHaveTitle(/LegalRAG/);
    
    // Check main heading
    await expect(page.getByRole('heading', { name: 'LegalRAG' })).toBeVisible();
    
    // Check description
    await expect(page.getByText(/Platformă RAG pentru documente legale/)).toBeVisible();
    
    // Check CTA buttons
    await expect(page.getByRole('button', { name: 'Începe gratuit' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Vezi prețuri' })).toBeVisible();
  });

  test('should navigate to pricing page', async ({ page }) => {
    await page.goto('/');
    
    await page.getByRole('button', { name: 'Vezi prețuri' }).click();
    
    await expect(page).toHaveURL(/.*pricing/);
    await expect(page.getByRole('heading', { name: /Prețuri/ })).toBeVisible();
  });
});
