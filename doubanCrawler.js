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
      console.log(baidu_url);
      return baidu_url;
    }
    else
      return null;
  }, selector);
  return tc;
}

async function crawl(page, ISBN)
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

     const site_base = 'https://book.douban.com/';
     const SEARCH_URL_TEMPLATE = 'https://book.douban.com/subject_search?search_text=ISBN&cat=1001'
     let searchUrl = SEARCH_URL_TEMPLATE.replace("ISBN", ISBN);


     await page.goto(searchUrl, {waitUntil: 'networkidle2', timeout:0,});
     let detailUrl = await getSelectorHref(page, SEARCH_ISBN_RESULT_HREF_SEL);
     console.log("detail Url: "+detailUrl);
     // await page.goto(detailUrl);
     // await page.waitFor(7*1000);
     await page.goto(detailUrl, {waitUntil: 'networkidle2', timeout:0,});
     // let bookRatinb = await getTextContent(page, DETAIL_RATING_NUMBER_SEL);
     let bookRatingUser = await getTextContent(page, DETAIL_RATING_USER_NUMBER_SEL);
     let bookIntro = await getTextContent(page, DETAIL_BRIEF_SEL);
     let authorInfo = await getTextContent(page, DETAIL_AUTHOR_BRIEF_SEL);
     let bookTagsLen = await getSelectorLength(page, DETAIL_TAGS_LEN_SEL);
     var bookTags = [];
     var bookInfos = [];
     for (var i = 0; i < bookTagsLen; i++) {
       var sel = DETAIL_TAGS_SEL.replace('INDEX', i);
       let tag = await getTextContent(page, sel);
       bookTags.push(tag);
     }
     let infoLen  = await getSelectorLength(page, DETAIL_PAGE_BOOK_INFO_LEN_SEL);
     for (var i = 0; i < infoLen; i++) {
       var sel = DETAIL_PAGE_BOOK_INFO_SEL.replace('INDEX', i);
       let tag = await getTextContent(page, sel);
       bookInfos.push(tag);
     }
     let bookInfoBlock = await getTextContent(page, DETAIL_BOOK_INFO_BLOCK_SEL);

     console.log("douban rating users:"+ bookRatingUser);
     console.log("douban intro :"+ bookIntro);
     console.log("author info:"+ authorInfo);
     // console.log("douban tags"+ bookTags);
     // console.log("douban info"+ bookInfoBlock.replace(/\r?\n|\r/g, "").replace(/\s+/g,' '));
     var bookInfoArray = bookInfoBlock.replace(/\r?\n|\r/g, "").replace(/\s+/g,' ').split(' ');
     // console.log("info array "+bookInfoArray);

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
  const conditions = {$and :[
  { "bookSerial": {"$exists": true}},
  {"bookSerial":{$ne: ""}}
  ]}
  // const conditions = { "$and":[
  //                               {"$or":[
  //                                 {"ctdiskUrl": {"$exists": false}},
  //                                 {"baiduCode": {"$exists": false}}
  //                               ]},
  //                               {"bookUrl":{"$exists":true}},
  //                               {"downloaded":{"$exists":false}},
  //                               {"lastCrawlCopyTime":{"$exists":false}}
  //                             ]
  //                     };
  const options = { limit:100 };
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
    for (var i = 54; i < r.length && tick < max_crawled_items; i++)
    {
      book = r[i];
      console.log(book);
      if(book.bookSerial == null)
        continue;
      var ISBN = book.bookSerial.split("：").pop();
      Logger.trace("NO. "+i+" book: "+ISBN);
      await crawl(page, ISBN);
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
          headless: false
        });
        const page = await browser.newPage();
        await fakeMain(page, 3);
        await browser.close();
        mongoose.connection.close();
        Logger.info("detailCrawler Session END PID@"+process.pid);
    } catch (e) {
        throw(e);
    }
})();
