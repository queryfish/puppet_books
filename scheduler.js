const puppeteer = require('puppeteer');
const CREDS = require('./creds');
const Configs = require('./configs');
const mongoose = require('mongoose');
const Book = require('./models/book');
const crawlerConfig = require('./models/crawlerConfig')
const isRunning = require('is-running');
const process = require('process');
const LOG4JS = require('./logger');
const Logger = LOG4JS.download_logger;

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
  const options = { limit: 1 };
  var query = crawlerConfig.find(conditions ,null ,options);
  let resultArray = await query.exec();
  await mongoose.connection.close();

  // 0 means worker is free or else, the worker is occupied
  if(resultArray.length == 0)
    return 0;
  var prePid = resultArray[0]["workerState"];
  if(isRunning(prePid))
    return prePid;
  else {
    return 0;
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
    // if idle returns 0, or else return the worker PID which occupied
    if(isIdle > 0)
    {
        Logger.trace("Work available");
        await setWorkerState(process.pid);
    }
    else
    {
        Logger.warn("Worker is occupied by PID@", isIdle);
        return;
    }

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

// var datetime = require('node-datetime');
// var formatted = datetime.create().format('Ymd_HMS');
// const logfile = Configs.workingPath+'logs/'+formatted+'.log';

process.on('exit', (code) => {
  Logger.info("process :"+process.pid);
  Logger.info(`About to exit with code: ${code}`);
  const crawler_code = Number(process.argv[2])+1;
  if(crawler_code < Configs.greedy*5)
  {
      require('child_process').fork(Configs.workingPath+'scheduler.js',[crawler_code%5] );
  }

});

process.on('unhandledRejection', (reason, promise) => {
  var message = ('Unhandled Rejection at:', promise, 'reason:', reason);
  Logger.error(message);
  process.exit(0);
  // Application specific logging, throwing an error, or other logic here
});
/*
 main
*/
(async () => {
    try {
      Logger.info("scheduler start dancing PID@"+process.pid);
      // const fs = require('fs');
      // var access = fs.createWriteStream(logfile);
      const crawler_code = Number(process.argv[2]);
      // process.stdout.write = process.stderr.write = access.write.bind(access);
      await schedule(crawler_code);
      Logger.info("scheduler finish dancing PID@"+process.pid);

    } catch (e) {
      Logger.error(e);
      throw(e);
    }
})();
