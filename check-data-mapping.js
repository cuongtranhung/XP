const { chromium } = require('playwright');

async function checkMapping() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Login
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'cuongtranhung@gmail.com');
    await page.fill('input[name="password"]', '@Abcd6789');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 5000 });

    // Go to table view
    await page.goto('http://localhost:3000/forms/e5b13cb9-56b6-4ae4-bdfd-533370a5c049/submissions/table-view');
    await page.waitForTimeout(2000);

    // Check headers
    console.log('CHECKING COLUMN HEADERS:');
    const headers = await page.locator('thead th').allTextContents();
    headers.forEach((h, i) => console.log(`  Column ${i}: ${h}`));

    // Check first row data
    console.log('\nFIRST ROW DATA:');
    const cells = await page.locator('tbody tr:first-child td').allTextContents();
    cells.forEach((c, i) => console.log(`  Cell ${i}: ${c}`));

    // Test editing Age (should be column 4)
    console.log('\nTESTING AGE FIELD:');
    const ageCell = await page.locator('tbody tr:first-child td').nth(4);
    console.log('Age cell content:', await ageCell.textContent());
    
    await ageCell.click();
    await page.waitForTimeout(500);
    
    // Check what type of input appears
    const textInput = await page.locator('td input[type="text"]:visible');
    const numberInput = await page.locator('td input[type="number"]:visible');
    
    if (await numberInput.count() > 0) {
      console.log('✅ Number input appeared (correct for Age)');
      await numberInput.fill('30');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      console.log('New age value:', await ageCell.textContent());
    } else if (await textInput.count() > 0) {
      console.log('⚠️ Text input appeared (wrong for Age field)');
      const value = await textInput.inputValue();
      console.log('Current value in input:', value);
    }

    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

checkMapping();
