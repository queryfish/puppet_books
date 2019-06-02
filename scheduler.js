const puppeteer = require('puppeteer');
const CREDS = require('./creds');
const mongoose = require('mongoose');
const Book = require('./models/book');
const copyCrawler = require('./copyCrawler');
const detailCrawler = require('./detailCrawler');
const listCrawler = require('./listCrawler');
const util = require('./utils');
const MAX_CRAWL_NUM = 200;
const DB_BATCH = 50;
const DB_URL = 'mongodb://localhost/sobooks';
const cookieFile = './cookieJar';

function assertMongoDB() {
  if (mongoose.connection.readyState == 0) {
    mongoose.connect(DB_URL);
  }
}

async function booksToCopy() {
  assertMongoDB();
  // if this email exists, update the entry, don't insert
  const conditions = { "$and":[
                          {"baiduUrl": {"$exists": true}},
                          {"baiduCode":{"$exists":true}},
                          {"lastCrawlCopyTime":{"$exists":false}},
                          {"badApple":{"$exists":false}}
                        ] };
  const options = { limit: DB_BATCH };
  var query = Book.find(conditions ,null ,options);
  const resultArray = await query.exec();
  return resultArray.length;
}

async function booksToDetail() {
  assertMongoDB();
  // if this email exists, update the entry, don't insert
  const conditions = { "$or":[
                          {"baiduUrl": {"$exists": false}},
                          {"baiduCode":{"$exists":false}}
                        ] };
  const options = { limit: DB_BATCH };
  var query = Book.find(conditions ,null ,options);
  const resultArray = await query.exec();
  return resultArray.length;
}

async function schedule() {
  //TODO: check the state if running just quit and carry on for idle
  //TODO: mark the single state of this scheduler to running
    const browser = await puppeteer.launch({
      headless: true
    });
    const page = await browser.newPage();
    await util.injectCookiesFromFile(page, cookieFile);
    await page.waitFor(5 * 1000);

    let copy = await booksToCopy();
    if(copy > 0){
      //start copy crawler
      await copyCrawler.run(page);
    }
    else{
      let detail = await booksToDetail();
      if(detail >0){
        // start detail crawler
        await detailCrawler.run(page, 100000);
      }
      else {
        // start list crawler
        await listCrawler.run(page);
      }
    }
    await browser.close();
    // mark the single state of this scheduler to idle
}

async function retry(maxRetries, fn) {
  console.log("retry time "+maxRetries);
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
    try {
      await retry(3, schedule)
    } catch (e) {
      throw(e);
    }
    mongoose.connection.close();
    console.log("gonna dance, scheduler");
})();
