const puppeteer = require('puppeteer');
const CREDS = require('./creds');
const Configs = require('./configs');
const mongoose = require('mongoose');
const Book = require('./models/book');
const crawlerConfig = require('./models/crawlerConfig')
const isRunning = require('is-running');
const process = require('process');
const Logger = require('./logger');
const copyCrawler = require('./copyCrawler');
const detailCrawler = require('./detailCrawler');
const listCrawler = require('./listCrawler');
const util = require('./utils');
const MAX_CRAWL_NUM = 200;

// const cookieFile = '/home/steve/puppy/cookieJar';

function assertMongoDB() {
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Configs.dbUrl);
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
  const options = { limit: Configs.crawlStep };
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
  if(resultArray.length == 0)
    return true;
  if(resultArray[0]["workerState"] <= 1) //manus means idle
      return true;
  else {
    // further check if the process if running
    var prePid = resultArray[0]["workerState"];
    if(isRunning(prePid))
      return false;
    else {
      return true;
    }
  }
}

function setWorkerState() {
  assertMongoDB();
  // if this email exists, update the entry, don't insert
  const conditions = { index:1}
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };

  //make this sync
  crawlerConfig.findOneAndUpdate(conditions, {"workerState":process.pid}, options, (err, result) => {
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
  const options = { limit: Configs.crawlStep };
  var query = Book.find(conditions ,null ,options);
  const resultArray = await query.exec();
  return resultArray.length;
}

async function schedule() {
  //TODO: check the state if running just quit and carry on for idle
    let isIdle = await isWorkerIdle();
    if(isIdle)
    {
        setWorkerState();// 1 for busy
    }
    else{
      return;
    }
  //TODO: mark the single state of this scheduler to running
    const browser = await puppeteer.launch({
      headless: true
    });
    const page = await browser.newPage();
    await util.injectCookiesFromFile(page, Configs.cookieFile);
    await page.waitFor(5 * 1000);

    //Should we run this unconditionally?
    await listCrawler.run(page);
    // let detail = await booksToDetail();
    // let copy = await booksToCopy();

    // if(detail >0){
      // start detail crawler
      await detailCrawler.run(page, 100000);
    // }else if(copy > 0){
      //start copy crawler
      await copyCrawler.run(page);
    // }
    // else{
    //     await listCrawler.run(page);
    // }
    await browser.close();

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

// process.on('uncaughtException', (err, origin) => {
//   // fs.writeSync(
//   console.log(
//     process.stderr.fd,
//     `Caught exception: ${err}\n` +
//     `Exception origin: ${origin}`
//   );
//   process.exit(0);
// });

var datetime = require('node-datetime');
var formatted = datetime.create().format('Ymd_HMS');
const logfile = Configs.workingPath+'logs/'+formatted+'.log';

process.on('exit', (code) => {
  mongoose.connection.close();
  console.log(`About to exit with code: ${code}`);
  //var child = require('child_process').fork('emailer.js',[logfile] );

});

process.on('unhandledRejection', (reason, promise) => {
  var message = ('Unhandled Rejection at:', promise, 'reason:', reason);
  console.log(message);
  process.exit(0);
  // Application specific logging, throwing an error, or other logic here
});
/*
 main
*/
(async () => {
    try {

      // await retry(3, schedule)
      const fs = require('fs');
      var access = fs.createWriteStream(logfile);
      //process.stdout.write = process.stderr.write = access.write.bind(access);
      console.log("scheduler start dancing PID@", process.pid);
      await schedule();
    } catch (e) {
      throw(e);
    }
    mongoose.connection.close();
    Logger.info("scheduler finish dancing PID@", process.pid);
})();
