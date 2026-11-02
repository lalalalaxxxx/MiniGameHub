'use strict';
// Existing functional flows can still explicitly stay on a result or open a tool.
// The separate UX suite tests automatic progression without this helper.
async function uxControl(page, selector) {
  const control = page.locator(selector);
  if (await control.getAttribute('data-ux-auto') === 'true') {
    await page.locator('.ux-next button').click({force:true});
  }
  if (await control.evaluate(el => !!el.closest('#game-tools')) && !await page.locator('#game-tools').evaluate(el => el.open)) {
    await page.locator('#game-more').click({force:true});
  }
  return control;
}
module.exports = {uxControl};
