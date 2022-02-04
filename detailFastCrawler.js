const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const Book = require('./models/book');
const CREDS = require('./creds');
const Config = require('./configs');
const LOG4JS = require('./logger');
const Logger = LOG4JS.download_logger;
const StatsLogger = LOG4JS.stats_logger;
const MAX_CRAWL_NUM = 200;
const request = require('async-request');
const cheerio = require('cherio');
const URL = require('url').URL;

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

async function crawl( detailUrl)
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

     let response = await request(detailUrl);
     const $ = cheerio.load(response.body);

     var bookObj = {"bookUrl": detailUrl};
     Logger.info("extracting "+detailUrl);
     // bookObj["author"] = await getTextContent(page, AUTHOR_SEL);

     // let uploadDateString = await getTextContent(page, UPLOAD_DATE_SEL);
     let uploadDateString = $(UPLOAD_DATE_SEL).text();
     if(uploadDateString!= null)
      bookObj["uploadDate"]  = uploadDateString.substring(3, uploadDateString.length);
     // bookObj["bookSerial"]= await getTextContent(page, ISBN_SEL);
     bookObj["bookSerial"] = $(ISBN_SEL).text();
     // bookObj["bookBrief"]  = await getTextContent(page, BOOK_BRIEF_SEL);
     bookObj["bookBrief"]  = $(BOOK_BRIEF_SEL).text();
     // bookObj["category"] = await getTextContent(page, CATEGORY_SEL);
     // bookObj["tags"] = await getTextContent(page, TAGS_SEL);

     //body > section > div.content-wrap > div > article > div.productDescriptionWrapper > div > table > tbody > tr:nth-child(3) > td > a:nth-child(3)
     const ct_download_url_selector = "body > section > div.content-wrap > div > article > table > tbody > tr:nth-child(3) > td > a:nth-child(3)";
     const ct_download_url_selector_wc = "body > section > div.content-wrap > div > article > *  tbody > tr:nth-child(3) > td > a:nth-child(3)";
     const url_selector = 'table.dltable > tbody * a:first-of-type';
     // let baidu_url = await extractUrl(url_selector);
     var href = $(url_selector).attr("href");
     var diskName = $(url_selector).text();
     if(href != null && href != "" && typeof(href) != undefined &&
        href.indexOf("http")==0){
       var temp_url  = new URL(href);
       var baidu_url = temp_url.searchParams.get('url');
     }
     if(diskName.indexOf("城") >= 0){
        var ct_url = baidu_url;
        baidu_url = null;
     }
     else{
       // let ct_url = await extractUrl(ct_download_url_selector);
         href = $(ct_download_url_selector_wc).attr("href");
         if(href != null && href != "" && typeof(href) != undefined &&
       href.indexOf("http")==0){
           var temp_url  = new URL(href);
           var ct_url = temp_url.searchParams.get('url');
         }
     }

     if(baidu_url!=null)
        bookObj["baiduUrl"]= baidu_url;
      else
        bookObj["baiduUrl"]= "NONE";
     if(ct_url != null)
     {
        statCount++;
        bookObj["ctdiskUrl"]= ct_url;
     }
     else{
	     // SLOW means this page should be crawled by a slow puppeteer crawler.
        bookObj["ctdiskUrl2_code"]= 'SLOW';
     }
     Logger.trace("Get baidu url:"+baidu_url);
     Logger.trace("Get CT url:"+ct_url);
     await upsertBook(bookObj);
     Logger.info("book detailed :"+detailUrl);
}

function assertMongoDB() {
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Config.dbUrl);
  }
}

async function assertBook() {
  assertMongoDB();
  const conditions = { "$and":[
                                 //{"$or":[
                                  {"ctdiskUrl": {"$exists": false}},
                                  {"ctdiskUrl2_code": {"$ne": 'NONE'}},
                                  //{"baiduCode": {"$exists": false}}
                                 //]},
                                {"bookUrl":{"$exists":true}},
                                {"downloaded":{"$exists":false}},
                                //{"lastCrawlCopyTime":{"$exists":false}},
                                {"isBookUrlValid":{"$ne":false}}
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

// exports.run =
async function fakeMain(max_crawled_items)
{
    var tick = 0;
    Logger.trace("in fakeMain");
    // Logger.info(r);
    // while(statCount < Config.crawlStep && tick < max_crawled_items)
    {
      var r = await assertBook();
      Logger.info(r.length+" books to be detailed ...");
      for (var i = 0; i < r.length; i++, tick++)
      {
        book = r[i];
        Logger.trace("NO. "+i+" book: "+book.bookName);
        await crawl(book.bookUrl);
      }
    }

    if(r.length > 0)
	StatsLogger.info("DetailCrawler Rate "+statCount+"/"+r.length);

}
/*
 main
*/
(async () => {
    try {
        Logger.info("Detail Fast Crawler Session START  PID@"+process.pid);
        await fakeMain(1);
        mongoose.connection.close();
        Logger.info("Detail Fast Crawler Session END PID@"+process.pid);
    } catch (e) {
        throw(e);
    }
})();
