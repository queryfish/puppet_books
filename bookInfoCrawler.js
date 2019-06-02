const puppeteer = require('puppeteer');
const CREDS = require('./creds');
const mongoose = require('mongoose');
const Book = require('./models/book');
const Logger = require('./logger').Logger;
const MAX_CRAWL_NUM = 200;
const DB_BATCH = 10;
// const fs = require('fs');

function upsertBook(bookObj) {
  const DB_URL = 'mongodb://localhost/sobooks';

  if (mongoose.connection.readyState == 0) {
    mongoose.connect(DB_URL);
  }

  // if this email exists, update the entry, don't insert
  const conditions = { bookUrl: bookObj.bookUrl };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };

  Book.findOneAndUpdate(conditions, bookObj, options, (err, result) => {
    if (err) {
      throw err;
    }
  });
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

// exports.crawl =
 async function crawl(page, detailUrl)
{
  // dom element selectors
  const CHECKCODE_SELECTOR = 'input.euc-y-i';
  const PASSWORD_SELECTOR = '#password';
  // const BUTTON_SELECTOR = '#login > form > div.auth-form-body.mt-3 > input.btn.btn-primary.btn-block';
  const BUTTON_SELECTOR = 'input.euc-y-s';
  const AUTHOR_SEL      = 'body > section > div.content-wrap > div > article > div.book-info > div.book-left > div > div.bookinfo > ul > li:nth-child(2)';
  const TAGS_SEL = 'body > section > div.content-wrap > div > article > div.book-info > div.book-left > div > div.bookinfo > ul > li:nth-child(5)';
  const UPLOAD_DATE_SEL = 'body > section > div.content-wrap > div > article > div.book-info > div.book-left > div > div.bookinfo > ul > li:nth-child(6)';
  const ISBN_SEL        = 'body > section > div.content-wrap > div > article > div.book-info > div.book-left > div > div.bookinfo > ul > li:nth-child(8)';
  const BOOK_BRIEF_SEL  = 'body > section > div.content-wrap > div > article > p:nth-child(5)';
  const AUTHOR_BRIEF_SEL= 'body > section > div.content-wrap > div > article > p:nth-child(8)';
  const CATEGORY_SEL   = '#mute-category > a';

  await page.goto(detailUrl, {waitUntil: 'networkidle2'});
  var bookObj = {"bookUrl": detailUrl};
  Logger.info("extracting "+detailUrl);
  bookObj["author"] = await getTextContent(page, AUTHOR_SEL);
  let uploadDateString = await getTextContent(page, UPLOAD_DATE_SEL);
  bookObj["uploadDate"]  = uploadDateString.substring(3, uploadDateString.length);
  bookObj["bookSerial"]= await getTextContent(page, ISBN_SEL);
  bookObj["bookBrief"]  = await getTextContent(page, BOOK_BRIEF_SEL);
  bookObj["category"] = await getTextContent(page, CATEGORY_SEL);
  bookObj["tags"] = await getTextContent(page, TAGS_SEL);
  Logger.info(bookObj);
  // await page.waitFor(5 * 1000);

  await page.click(CHECKCODE_SELECTOR);
  await page.keyboard.type(CREDS.checkcode);
  await page.click(BUTTON_SELECTOR);
  // await page.click(BUTTON_SELECTOR).then(() => page.waitForNavigation({waitUntil: 'load'}));
  // await page.click(BUTTON_SELECTOR, {waitForNavigationUntil: 'load'})
  await page.waitFor(5*1000);

  let baiduPickup = await getTextContent(page, 'div.e-secret > strong');
  var l = baiduPickup.length;
  bookObj["baiduCode"]  = baiduPickup.substring(l-4, l);

  // const url_selector = 'table.dltable > tbody > tr:nth-child(2) > td > a:nth-child(0)';
  const url_selector = 'table.dltable > tbody * a:first-of-type';
  let dl_url = await page.evaluate((sel) => {
    let baidu_url = document.querySelector(sel).getAttribute("href");
    Logger.info(baidu_url);
    return baidu_url;
  }, url_selector);

  const temp_url = new URL(dl_url);
  bookObj["baiduUrl"]= temp_url.searchParams.get('url');

  Logger.info("book detailed ");
  Logger.info(bookObj.bookName+"@"+bookObj.author);

  upsertBook(bookObj);

}

function assertMongoDB() {
  const DB_URL = 'mongodb://localhost/sobooks';
  if (mongoose.connection.readyState == 0) {
    mongoose.connect(DB_URL);
  }
}

async function assertBook() {
  assertMongoDB();
  // if this email exists, update the entry, don't insert
  const conditions = { "baiduUrl": {"$exists": false} };
  const options = { limit: DB_BATCH };
  var query = Book.find(conditions ,null ,options);
  const result = await query.exec();
  return result;
}

async function automate() {
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

  var tick = 0;
  var r = await assertBook();
  while(r.length > 0 && tick < MAX_CRAWL_NUM){
    Logger.info(r.length+" books to go !!!");
    Logger.info(r);
    for (var i = 0; i < r.length; i++) {
      book = r[i];
      Logger.info("crawling "+i+"th book detail "+book.bookName);
      await crawl(page, book.bookUrl);
      tick ++;
    }
    r = await assertBook();
  }

  browser.close();

}

/*
 main
*/
async function retry(maxRetries, fn) {
  Logger.info("retry time "+maxRetries);
  return await fn().catch(function(err) {
    if (maxRetries <= 0) {
      throw err;
    }
    return retry(maxRetries - 1, fn);
  });
}
/*
 main
*/
(async () => {
    // retry(10, automate)
    await automate();
})();
