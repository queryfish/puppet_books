const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const Book = require('./models/book');
const CREDS = require('./creds');
const Config = require('./configs');
const LOG4JS = require('./logger');
const Logger = LOG4JS.download_logger;
const StatsLogger = LOG4JS.stats_logger;
const MAX_CRAWL_NUM = 200;
// const fs = require('fs');
var statCount = 0;

async function upsertBook(bookObj)
{
  assertMongoDB();
  const conditions = { bookUrl: bookObj.bookUrl };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  const query = Book.findOneAndUpdate(conditions, bookObj, options);
  await query.exec();
}

async function getTextContent(page, selector)
{
  let tc = await page.evaluate((sel) => {
    if(document.querySelector(sel) != null)
      return document.querySelector(sel).textContent;
    else
      return "";
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

     await page.goto(detailUrl, {waitUntil: 'networkidle2', timeout:0,});

     // await page.goto(detailUrl, {waitUntil: 'load'});
     // await page.click(BUTTON_SELECTOR, {waitForNavigationUntil: 'load'})
     // await page.goto(detailUrl);
     // await page.waitFor(5*1000);
     var bookObj = {"bookUrl": detailUrl};
     Logger.info("extracting "+detailUrl);
     // bookObj["author"] = await getTextContent(page, AUTHOR_SEL);
     let uploadDateString = await getTextContent(page, UPLOAD_DATE_SEL);
     if(uploadDateString!= null)
      bookObj["uploadDate"]  = uploadDateString.substring(3, uploadDateString.length);
     bookObj["bookSerial"]= await getTextContent(page, ISBN_SEL);
     bookObj["bookBrief"]  = await getTextContent(page, BOOK_BRIEF_SEL);
     bookObj["category"] = await getTextContent(page, CATEGORY_SEL);
     bookObj["tags"] = await getTextContent(page, TAGS_SEL);


     // await page.click(CHECKCODE_SELECTOR);
     // await page.keyboard.type(CREDS.checkcode);
     // await page.click(BUTTON_SELECTOR);
     // // await page.click(BUTTON_SELECTOR).then(() => page.waitForNavigation({waitUntil: 'load'}));
     // await page.waitFor(10*1000);
     // let baiduPickup = await getTextContent(page, 'div.e-secret > strong');
     // var l = baiduPickup.length;
     // bookObj["baiduCode"]  = baiduPickup.substring(l-4, l);



     // const url_selector = 'table.dltable > tbody > tr:nth-child(2) > td > a:nth-child(0)';
     const ct_download_url_selector = "body > section > div.content-wrap > div > article > table > tbody > tr:nth-child(3) > td > a:nth-child(3)";
     const url_selector = 'table.dltable > tbody * a:first-of-type';
     let baidu_url = await extractUrl(page, url_selector);
     let ct_url = await extractUrl(page, ct_download_url_selector);
     if(baidu_url!=null)
        bookObj["baiduUrl"]= baidu_url;
     if(ct_url != null)
        bookObj["ctdiskUrl"]= ct_url;
     Logger.trace("Get baidu url:"+baidu_url);
     Logger.trace("Get Baidu code:"+bookObj['baiduCode']);
     Logger.trace("Get CT url:"+ct_url);
     await upsertBook(bookObj);
     Logger.info("book detailed :"+detailUrl);
     statCount++;
}

async function extractUrl(page ,selector)
{
    let dl_url = await page.evaluate((sel) =>
    {
         if(document.querySelector(sel) != null)
         {
           var href = document.querySelector(sel).getAttribute("href");
           var temp_url = new URL(href);
           return temp_url.searchParams.get('url');
         }
         else
           return null;
    }, selector);

    return dl_url;
}


function assertMongoDB() {
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Config.dbUrl);
  }
}

async function assertBook() {
  assertMongoDB();
  // const conditions = { "baiduUrl": {"$exists": false}}
  const conditions = { "$and":[
                                {"$and":[
                                  {"ctdiskUrl": {"$exists": false}},
                                  {"baiduUrl": {"$exists": false}}
                                ]},
                                {"bookUrl":{"$exists":true}}
                              ]
                      };
  // const conditions = { "$and":[ {"ctdiskUrl": {"$exists": false}},{"bookUrl":{"$exists":true}}]};
  const options = { limit: Config.crawlStep , sort:{"cursorId": -1} };
  var query = Book.find(conditions ,null ,options);
  const result = await query.exec();
  return result;
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

// exports.run =
async function fakeMain(page, max_crawled_items)
{
    var tick = 0;
    Logger.trace("in fakeMain");
    var r = await assertBook();
    Logger.info(r.length+" books to be detailed ...");
    // Logger.info(r);
    for (var i = 0; i < r.length && tick < max_crawled_items; i++, tick++)
    {
      book = r[i];
      Logger.trace("NO. "+i+" book: "+book.bookName);
      await crawl(page, book.bookUrl);
      tick ++;
    }
    StatsLogger.info("DetailCrawler Rate "+statCount+"/"+r.length);

}
/*
 main
*/
(async () => {
    try {
        Logger.info("detailCrawler Session START  PID@"+process.pid);
        const browser = await puppeteer.launch({
          headless: true
        });
        const page = await browser.newPage();
        await fakeMain(page, 10000);
        await browser.close();
        mongoose.connection.close();
        Logger.info("detailCrawler Session END PID@"+process.pid);
    } catch (e) {
        throw(e);
    }
})();
