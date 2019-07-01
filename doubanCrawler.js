const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const Book = require('./models/book');
const CREDS = require('./creds');
const Config = require('./configs');
const LOG4JS = require('./logger');
const Logger = LOG4JS.download_logger;
const StatsLogger = LOG4JS.stats_logger;
const MAX_CRAWL_NUM = 200;
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

async function getSelectorLength(page, selector) {
  let tc = await page.evaluate((sel) => {
    if(document.querySelector(sel) != null){
      // let baidu_url = document.querySelectorAll(sel).length;
      let baidu_url = document.querySelectorAll(sel).length;
      Logger.trace(baidu_url);
      return baidu_url;
    }
    else
      return null;
  }, selector);
  return tc;
}

async function crawl(page, bookObj)
{
      var ISBN = bookObj.bookSerial.split("：").pop();
     // dom element selectors
     const SEARCH_INPUT_SEL = '#inp-query';
     const SEARCH_BUTTON_SEL = '#db-nav-book > div.nav-wrap > div > div.nav-search > form > fieldset > div.inp-btn > input[type=submit]';
     const SEARCH_RESULT_LIST_SEL = '#root > div > div._2le4fbihe > div._ehwzi9rhh > div:nth-child(1) > div > div > div'
     // const SEARCH_ISBN_RESULT_HREF_SEL = '#root > div > div._2le4fbihe > div._ehwzi9rhh > div:nth-child(1) > div > div > div > div.title > a'
     const SEARCH_ISBN_RESULT_HREF_SEL ='div.detail > div.title > a'
     const DETAIL_BOOK_INFO_BLOCK_SEL = '#info';
     const DETAIL_PAGE_BOOK_INFO_LEN_SEL = '#info > span';
     const DETAIL_PAGE_BOOK_INFO_SEL = '#info > span:nth-child(INDEX)';
     const DETAIL_RATING_NUMBER_SEL = '#interest_sectl > div > div.rating_self.clearfix > strong';
     const DETAIL_RATING_USER_NUMBER_SEL = '#interest_sectl > div > div.rating_self.clearfix > div > div.rating_sum > span > a';
     // const DETAIL_BRIEF_SEL = '#link-report > span.short > div.intro';
     const DETAIL_BRIEF_SEL = '#link-report > * > div.intro';
     // const DETAIL_AUTHOR_BRIEF_SEL = 'div.related_info > div:nth-child(1) > * > div.intro';
     const DETAIL_AUTHOR_BRIEF_SEL ='#content > div > div.article > div.related_info > div:nth-child(4) > div > div'
     const DETAIL_TAGS_SEL = '#db-tags-section > div.indent  > span:nth-child(INDEX) > a';
     const DETAIL_TAGS_LEN_SEL = '#db-tags-section > div.indent > span';
     const DETAIL_COMMENTS = '#content > div > div.article > div.related_info > div.mod-hd > h2 > span.pl > a';

     // const site_base = 'https://book.douban.com/';
     const SEARCH_URL_TEMPLATE = 'https://book.douban.com/subject_search?search_text=ISBN&cat=1001'
     let searchUrl = SEARCH_URL_TEMPLATE.replace("ISBN", ISBN);
     // await page.goto(searchUrl, {waitUntil: 'networkidle2'});
     await page.goto(searchUrl);
     // await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout:0});
     await page.waitFor(10*1000);
     let detailUrl = await getSelectorHref(page, SEARCH_ISBN_RESULT_HREF_SEL);
     Logger.trace("detail Url: "+detailUrl);
     // var bookInfoString = bookInfoBlock.replace(/\r?\n|\r/g, "").replace(/\s+/g,' ');
     bookObj["doubanUrl"] = detailUrl;
     await upsertBook(bookObj);

}

function assertMongoDB() {
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Config.dbUrl);
  }
}

async function assertBook() {
  assertMongoDB();
  const conditions = {$and :[
    // {"bookSerial": {"$exists": true}},
    {"bookSerial":{"$ne": null}},
    {"bookSerial":{"$ne": ""}},
    {"doubanUrl":{"$exists":false}}
  ]}
  const options = { limit:Config.crawlStep };
  var query = Book.find(conditions ,null ,options);
  const result = await query.exec();
  return result;
}

// exports.run =
async function fakeMain(page, max_crawled_items)
{
    var tick = 0;
    Logger.trace("in fakeMain");
    var r = await assertBook();
    Logger.info(r.length+" books to be detailed ...");
    // Logger.info(r);
    for (var i = 0; i < r.length && tick < max_crawled_items; i++)
    {
      book = r[i];
      Logger.trace("bookName: "+book.bookName);
      Logger.trace("bookUrl: "+book.bookUrl);
      Logger.trace("bookSerial: "+book.bookSerial);
      if(book.bookSerial == null)
        continue;
      var ISBN = book.bookSerial.split("：").pop();
      Logger.trace("NO. "+i+" book: "+ISBN);
      await crawl(page, book);
      tick ++;
    }
    StatsLogger.info("Douban Search Crawler Rate "+statCount+"/"+r.length);

}
/*
 main
*/
(async () => {
    try {
        Logger.info("Douban Search Crawler Session START  PID@"+process.pid);
        const browser = await puppeteer.launch({
          headless: true
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36');

        // page.on('response', response => {
        //   console.log("get some response");
        //   console.log(response.url());
        //   console.log(response.headers());
        //   response.text().then(function (textBody) {
        //       // console.log(textBody);
        //     })
        // })
        await fakeMain(page, 10000);
        await browser.close();
        mongoose.connection.close();
        Logger.info("Douban Search Crawler Session END PID@"+process.pid);
    } catch (e) {
        throw(e);
    }
})();
