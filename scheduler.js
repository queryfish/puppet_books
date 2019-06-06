const puppeteer = require('puppeteer');
const CREDS = require('./creds');
const Configs = require('./configs');
const mongoose = require('mongoose');
const Book = require('./models/book');
const crawlerConfig = require('./models/crawlerConfig')
const isRunning = require('is-running');
const process = require('process');
const Logger = require('./logger');
// const copyCrawler = require('./copyCrawler');
// const detailCrawler = require('./detailCrawler');
// const listCrawler = require('./listCrawler');
const util = require('./utils');
const MAX_CRAWL_NUM = 200;
// const db = mongoose.connect( Configs.dbUrl,
//   {
//     // sets how many times to try reconnecting
//     reconnectTries: Number.MAX_VALUE,
//     // sets the delay between every retry (milliseconds)
//     reconnectInterval: 1000
//     }
//   // {keepAlive: 1, connectTimeoutMS: 30000, reconnectTries: 30, reconnectInterval: 2000}
//   // {auto_reconnect: true, poolSize: 10}
// );

function assertMongoDB() {
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Configs.dbUrl);
  }
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
  await mongoose.connection.close();

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

async function setWorkerState(workerState)
{
  assertMongoDB();
  const conditions = { index:1}
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };

  const query = crawlerConfig.findOneAndUpdate(conditions, {"workerState":workerState}, options);
  let ret = await query.exec();
  await mongoose.connection.close();
  return ret;

}

async function schedule(crawler_code)
{
    let isIdle = await isWorkerIdle();
    if(isIdle)
        await setWorkerState(process.pid);
    else
      return;

    var crawlers = ['listCrawler', 'detailCrawler', 'CTFileCrawler', 'CTDownloader', 'copyCrawler'];
    var index = crawler_code%crawlers.length;
    require(Configs.workingPath+crawlers[index]);
}

process.on('uncaughtException', (err, origin) => {
  // fs.writeSync(
  console.log(
    process.stderr.fd,
    `Caught exception: ${err}\n` +
    `Exception origin: ${origin}`
  );
  // process.exit(0);
});

var datetime = require('node-datetime');
var formatted = datetime.create().format('Ymd_HMS');
const logfile = Configs.workingPath+'logs/'+formatted+'.log';

process.on('exit', (code) => {
  console.log(`About to exit with code: ${code}`);
  
  // if(Configs.greedyMode && Configs.greedyMode == true)
  // if(code ==0)
  if(0)
  {
      const crawler_code = Number(process.argv[2])+1;
      require('child_process').fork(Configs.workingPath+'scheduler.js',[crawler_code%5] );
  }

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
      const fs = require('fs');
      var access = fs.createWriteStream(logfile);
      const crawler_code = Number(process.argv[2]);
      // process.stdout.write = process.stderr.write = access.write.bind(access);
      console.log("scheduler start dancing PID@", process.pid);
      await schedule(crawler_code);

    } catch (e) {
      console.log(e);
      throw(e);
    }
    console.log("scheduler finish dancing PID@", process.pid);
})();
