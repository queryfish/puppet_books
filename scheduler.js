const puppeteer = require('puppeteer');
const CREDS = require('./creds');
const mongoose = require('mongoose');
const Book = require('./models/book');
const crawlerConfig = require('./models/crawlerConfig')
const Logger = require('./logger');
const copyCrawler = require('./copyCrawler');
const detailCrawler = require('./detailCrawler');
const listCrawler = require('./listCrawler');
const util = require('./utils');
const MAX_CRAWL_NUM = 200;
const DB_BATCH = 50;
const DB_URL = 'mongodb://localhost/sobooks';
const cookieFile = '/home/steve/puppy/cookieJar';
// const cookieFile = './cookieFile';

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

async function isWorkerIdle() {
  assertMongoDB();
  // if this email exists, update the entry, don't insert
  const conditions = { "$and":[
                          {"index":{"$eq":1}},
                          {"workerState": {"$exists": true}}
                        ] };
  const options = { limit: 5 };
  var query = crawlerConfig.find(conditions ,null ,options);
  let resultArray = await query.exec();
  if(resultArray.length ==0 || resultArray[0]["workerState"]==1) //zero means idle
  {
      // try to grab the lock
      return true;
  }
  else {
    return false;
  }
}

function setWorkerState(state) {
  assertMongoDB();
  // if this email exists, update the entry, don't insert
  const conditions = { index:1}
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };

  crawlerConfig.findOneAndUpdate(conditions, {"workerState":state}, options, (err, result) => {
    if (err) {
      throw err;
    }
  });
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
    let isIdle = await isWorkerIdle();
    if(isIdle)
    {
        setWorkerState(1);// 1 for busy
    }
    else{
      return;
    }
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
    setWorkerState(0); //0 for idle
    // mark the single state of this scheduler to idle
}

async function retry(maxRetries, fn) {
  Logger.info("retry time "+maxRetries);
  return await fn().catch(function(err) {
    if (maxRetries <= 0) {
      throw err;
    }
    return retry(maxRetries - 1, fn);
  });
}

const process = require('process');
// process.on('uncaughtException', (err, origin) => {
//   // fs.writeSync(
//   console.log(
//     process.stderr.fd,
//     `Caught exception: ${err}\n` +
//     `Exception origin: ${origin}`
//   );
//   process.exit(0);
// });

process.on('exit', (code) => {
  setWorkerState(0); //0 for idle
  mongoose.connection.close();
  console.log(`About to exit with code: ${code}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(0);
  // Application specific logging, throwing an error, or other logic here
});
/*
 main
*/
(async () => {
    try {
      // await retry(3, schedule)
      await schedule();
    } catch (e) {
      throw(e);
    }
    setWorkerState(0); //0 for idle
    mongoose.connection.close();
    Logger.info("gonna dance, scheduler");
})();
