const puppeteer = require('puppeteer');
const CREDS = require('./creds');
const Config = require('./configs');
const mongoose = require('mongoose');
const CrawlerConfig = require('./models/crawlerConfig');
const Book = require('./models/book');
const LOG4JS = require('./logger');
const Logger = LOG4JS.download_logger;
const StatsLogger = LOG4JS.stats_logger;
const fs = require('fs');
const MAX_PAGE_NUM = 200;
const MAX_TICKS = 100;
const BOOK_INFO_SITE = 'http://sobooks.cc'

async function getScannerCursor() {
  assertMongoDB();
  var query = Book.find({isBookUrlValid:{$exists:true}}).sort({"cursorId" : -1}).limit(1);
  const result = await query.exec();
  Logger.info("Getting Scanner BookId");
  Logger.info(result);
  if (result.length >0)
    return result[0].cursorId;
  else
      return -1;
}

async function getCursor() {
  assertMongoDB();
  const conditions = { "index": {"$eq":1 } };
  const options = { limit: 1 };
  var query = CrawlerConfig.find(conditions ,null ,options);
  const result = await query.exec();
  return result;
}

async function crawlBookListScanner(count)
{
  var tick =1;
  var bookId = 0;
  let result = await getScannerCursor();
  if(result == -1)
    bookId = Config.scannerStart;
  else
      bookId = result+1;

  var found = 0;
  while(bookId >0 && tick <= count){
      var pageUrl = 'https://sobooks.cc/books/'+bookId+".html";
      var exist = await assertBook(pageUrl);
      if(exist == null || exist.length == 0){
        // const request = require('request');
        let request = require('async-request');
        let response = await request(pageUrl);
        console.error('error:', response.error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode);
        // console.log('body:', body); // Print the HTML for the Google homepage.
        if(response && response.statusCode == 404)
        {
          Logger.error("!!!! Invalid url "+ pageUrl);
          await upsertBook({bookUrl:pageUrl, isBookUrlValid:false, cursorId:bookId});
        }
        else {
          Logger.info("Valid URL "+ pageUrl);
          await upsertBook({bookUrl:pageUrl, isBookUrlValid:true, cursorId:bookId});
          found ++;
        }
        tick ++;
      }
      else{
        // await upsertBook({bookUrl:pageUrl, isBookUrlValid:true , cursorId:bookId});
        Logger.warn("EXIST url "+pageUrl);
      }
      bookId ++;
  }
  StatsLogger.info('Scanned Books '+found+'/'+tick);

}

function assertMongoDB() {
  //
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Config.dbUrl);
  }
}

async function upsertBook(bookObj) {
  assertMongoDB();
  const conditions = { bookUrl: bookObj.bookUrl };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  let q = Book.findOneAndUpdate(conditions, bookObj, options);
  await q.exec();
}

async function assertBook(bookInfoUrl) {
  assertMongoDB();
  // if this email exists, update the entry, don't insert
  const conditions = { bookUrl: bookInfoUrl };
  // const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  var query = Book.findOne(conditions);
  const result = await query.exec();
  return result;
}

function isInvalidValue(v) {
  if(typeof(v) == "undefined") return true;
  if(v == null) return true;
  if(v == "") return true;
  return false;
}

// exports.run =
async function fakeMain(page)
{
  await crawlBookList(page, (p)=>{
    return (BOOK_INFO_SITE+'/page/'+p);
  });
}

/**** main ***/
// const process = require('process');
(async () => {
    try {
        Logger.info('List Crawler Session STARTED PID@ '+process.pid);
          await crawlBookListScanner(Config.scannerStep);
        await mongoose.connection.close();
        Logger.info('List Crawler Session END PID@ '+process.pid);
    } catch (e) {
        Logger.error(e);
        await mongoose.connection.close();
        await browser.close();
        throw(e);
    }

})();
