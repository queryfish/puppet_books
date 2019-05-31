const puppeteer = require('puppeteer');


async function test() {
  /*
  1- query from mongodb for impartial entry to be further crawl for detail
  2- use the crawl func and save it to db
  3- stop when MAX_CRAWL_NUM exceed or the db is out of candidate
  */
  const browser = await puppeteer.launch({
    headless: true
    // , defaultViewport: null
  });

  const page = await browser.newPage();
  await page.goto('https://www.baidu.com/', {waitUntil: 'networkidle2'});

  browser.close();

}




/*
 main
*/
(async () => {
    await test();
})();
