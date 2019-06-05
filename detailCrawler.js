const puppeteer = require('puppeteer');
const CREDS = require('./creds');
const Config = require('./configs');
const mongoose = require('mongoose');
const Book = require('./models/book');
const Logger = require('./logger');
const MAX_CRAWL_NUM = 200;

// const fs = require('fs');

function upsertBook(bookObj) {


  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Config.dbUrl);
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

async function crawl(page, detailUrl)
{
 // dom element selectors
 const CHECKCODE_SELECTOR = 'input.euc-y-i';
 const PASSWORD_SELECTOR = '#password';
 const BUTTON_SELECTOR = 'input.euc-y-s';
 const AUTHOR_SEL      = 'body > section > div.content-wrap > div > article > div.book-info > div.book-left > div > div.bookinfo > ul > li:nth-child(2)';
 const TAGS_SEL = 'body > section > div.content-wrap > div > article > div.book-info > div.book-left > div > div.bookinfo > ul > li:nth-child(5)';
 const UPLOAD_DATE_SEL = 'body > section > div.content-wrap > div > article > div.book-info > div.book-left > div > div.bookinfo > ul > li:nth-child(6)';
 const ISBN_SEL        = 'body > section > div.content-wrap > div > article > div.book-info > div.book-left > div > div.bookinfo > ul > li:nth-child(8)';
 const BOOK_BRIEF_SEL  = 'body > section > div.content-wrap > div > article > p:nth-child(5)';
 const AUTHOR_BRIEF_SEL= 'body > section > div.content-wrap > div > article > p:nth-child(8)';
 const CATEGORY_SEL   = '#mute-category > a';

 await page.goto(detailUrl, {waitUntil: 'networkidle2'});
 // await page.goto(detailUrl, {waitUntil: 'load'});
 // await page.click(BUTTON_SELECTOR, {waitForNavigationUntil: 'load'})
 // await page.goto(detailUrl);
 // await page.waitFor(5*1000);
 var bookObj = {"bookUrl": detailUrl};
 Logger.info("extracting "+detailUrl);
 // bookObj["author"] = await getTextContent(page, AUTHOR_SEL);
 let uploadDateString = await getTextContent(page, UPLOAD_DATE_SEL);
 bookObj["uploadDate"]  = uploadDateString.substring(3, uploadDateString.length);
 bookObj["bookSerial"]= await getTextContent(page, ISBN_SEL);
 bookObj["bookBrief"]  = await getTextContent(page, BOOK_BRIEF_SEL);
 bookObj["category"] = await getTextContent(page, CATEGORY_SEL);
 bookObj["tags"] = await getTextContent(page, TAGS_SEL);

 /*
 await page.click(CHECKCODE_SELECTOR);
 await page.keyboard.type(CREDS.checkcode);
 await page.click(BUTTON_SELECTOR);
 // await page.click(BUTTON_SELECTOR).then(() => page.waitForNavigation({waitUntil: 'load'}));
 await page.waitFor(10*1000);

 let baiduPickup = await getTextContent(page, 'div.e-secret > strong');
 var l = baiduPickup.length;
 bookObj["baiduCode"]  = baiduPickup.substring(l-4, l);
*/

 // const url_selector = 'table.dltable > tbody > tr:nth-child(2) > td > a:nth-child(0)';
 const ct_download_url_selector = "body > section > div.content-wrap > div > article > table > tbody > tr:nth-child(3) > td > a:nth-child(3)";
 const url_selector = 'table.dltable > tbody * a:first-of-type';
 let dl_url = await page.evaluate((sel) => {
   let baidu_url = document.querySelector(sel).getAttribute("href");
   return baidu_url;
 }, url_selector);

 let ct_download_url = await page.evaluate((sel) => {
   let url = document.querySelector(sel).getAttribute("href");
   return url;
 }, ct_download_url_selector);
 const temp_url = new URL(dl_url);
 const temp_url2 = new URL(ct_download_url);
 bookObj["baiduUrl"]= temp_url.searchParams.get('url');
 bookObj["ctdiskUrl"]= temp_url2.searchParams.get('url');
 Logger.info("ct_url:"+bookObj["ctdiskUrl"]);
 Logger.info(bookObj.bookName+"@"+bookObj.author);
 Logger.info("book detailed ");
 upsertBook(bookObj);

}


function assertMongoDB() {

  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Config.dbUrl);
  }
}

async function assertBook() {
  assertMongoDB();
  // const conditions = { "baiduUrl": {"$exists": false}} ;
  const conditions = { "$and":[
    {"ctdiskUrl": {"$exists": false}},{"bookUrl":{"$exists":true}}]} ;
  const options = { limit: Config.crawlStep , sort:{"cursorId": -1} };
  var query = Book.find(conditions ,null ,options);
  const result = await query.exec();
  return result;
}

exports.run =
async function(page, max_crawled_items) {
  /*
  1- query from mongodb for impartial entry to be further crawl for detail
  2- use the crawl func and save it to db
  3- stop when MAX_CRAWL_NUM exceed or the db is out of candidate
  */
  // const browser = await puppeteer.launch({
  //   headless: true,
  //   ignoreHTTPSErrors: true
  //   // , defaultViewport: null
  // });
  // const page = await browser.newPage();

  var tick = 0;
  var r = await assertBook();
  // while(r.length > 0 && tick < max_crawled_items){
    Logger.info(r.length+" books to be detailed ...");
    // Logger.info(r);
    for (var i = 0; i < r.length && tick < max_crawled_items; i++, tick++)
    {
      book = r[i];
      Logger.info("NO. "+i+" book: "+book.bookName);
      Logger.info(book.bookUrl);
      await crawl(page, book.bookUrl);
      tick ++;
    }
    // r = await assertBook();
  // }

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
// (async () => {
//     retry(10, automate)
// })();
