const puppeteer = require('puppeteer');
(async() => {
  const browser = await puppeteer.launch({dumpio: true});
  const page = await browser.newPage();
  await page.goto('https://news.ycombinator.com', {waitUntil: 'networkidle2'});
  await browser.close();
})();
