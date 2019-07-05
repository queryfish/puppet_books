const puppeteer = require('puppeteer');
const fs = require('fs');
const mongoose = require('mongoose');
const process = require('process');
const Book = require('./models/book');
const LOG4JS = require('./logger');
const Logger = LOG4JS.download_logger;
const StatsLogger = LOG4JS.stats_logger;
const CREDS = require('./creds');
const Configs = require('./configs');

var statCount = 0;

async function upsertBook(bookObj) {
  assertMongoDB();
  // if this email exists, update the entry, don't insert
  const conditions = { bookUrl: bookObj.bookUrl };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  var query = Book.findOneAndUpdate(conditions, bookObj, options);
  const result = await query.exec();
  return ;
}

async function getSelectorHref(page, selector) {
  let tc = await page.evaluate((sel) => {
    if(document.querySelector(sel) != null){
      let baidu_url = document.querySelector(sel).getAttribute("href");
      return baidu_url;
    }
    else
      return null;
  }, selector);
  return tc;
}

async function getTextContent(page, selector) {
  let tc = await page.evaluate((sel) => {
    if(document.querySelector(sel) != null)
      return document.querySelector(sel).textContent;
    else
      return null;
  }, selector);
  return tc;
}

async function fetchBook()
{
  const browser = await puppeteer.launch({
      headless: false,
      ignoreHTTPSErrors: true,
      defaultViewport: null
  });
  // Download and wait for download
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36');
  const freeProxyPageUrl = 'https://www.kuaidaili.com/free/';

  await page.goto(freeProxyPageUrl, {waitUntil: 'networkidle2', timeout:0,});
  await page.waitFor(5*1000);
  const ROW_SEL= '#list > table > tbody > tr:nth-child(1) ';

  let book_file_name = await getTextContent(page, ROW_SEL);
  Logger.trace('resolved book name'+ book_file_name);
  await browser.close()
  return ;

}

function assertMongoDB()
{
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Configs.dbUrl);
  }
}

async function assertBook() {
  assertMongoDB();
  // const conditions = { "baiduUrl": {"$exists": false}} ;
  const conditions = { "$and":[{"ctdiskUrl": {"$exists": true}}
                              ,{"ctdiskUrl":{"$ne":"NONE"}}
                               ,{"ctdownloadUrl":{"$exists":false}}
                               ,{"hasMobi":{"$exists": false}}
                               // ,{"savedBaidu":{$exists: false}}
                             ]
                     } ;
  const options = { limit: Configs.crawlStep , sort:{"cursorId": -1} };
  var query = Book.find(conditions ,null ,options);
  const result = await query.exec();
  console.log(result);
  return result;
}

// exports.run =
async function automate() {
  await fetchBook();
}

/*
 main
*/
(async () => {
    try {
      Logger.info("CTFileCrawler Session roll out PID: ", process.pid);
      await automate();
      mongoose.connection.close();
      Logger.info("CTFileCrawler Session END PID: ", process.pid);
      // as the CTFileCrawler often STALLED for the sake of FileDownloading Async Calls
      // we should check it to kill itself and children as well.
      // NOTE!!! Such way works, the scheduler should not shoot the Jammer.
      // Logger.warn("And I should kill myself here and now @"+process.pid);
      // process.kill(process.pid, "SIGINT");

    } catch (e) {
      Logger.error(e);
      throw(e);
    }

})();
