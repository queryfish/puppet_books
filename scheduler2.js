const puppeteer = require('puppeteer');
const Configs = require('./configs');
const mongoose = require('mongoose');
const Book = require('./models/book');
const crawlerConfig = require('./models/crawlerConfig')
const isRunning = require('is-running');
const process = require('process');
const LOG4JS = require('./logger');
const Logger = LOG4JS.download_logger;

const util = require('./utils');
const MAX_CRAWL_NUM = 200;

function assertMongoDB() {
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Configs.dbUrl);
  }
}

async function isWorkerIdle(workerName) {
  assertMongoDB();
  // if this email exists, update the entry, don't insert
  const conditions = {"$and":[
                          { "workerName": workerName },
	  		  {"workerState": {"$exists":true}}
  ]};
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

async function unsetWorkerState(workerName)
{
  assertMongoDB();
  const conditions = {workerName: {$exists:1}};
  const options = { $unset :{workerName:1}}
  const query = crawlerConfig.updateOne(conditions, options);
  let ret = await query.exec();
  await mongoose.connection.close();
  return ret;
}

async function setWorkerState(workerName, workerState)
{
  assertMongoDB();
  const conditions = { "workerName": workerName }
  const updates = {"workerState" :workerState};
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };

  const query = crawlerConfig.findOneAndUpdate(conditions, updates, options);
  let ret = await query.exec();
  await mongoose.connection.close();
  return ret;

}

var crawlers = [ 'listCrawler','detailCrawler', 'CTFileCrawler', 'CTDownloader'];

async  function schedule(workerName, crawler_code)
{
    let isIdle = await isWorkerIdle(workerName);
    // if idle returns 0, or else return the worker PID which occupied
	if(isIdle == 0)
    {
        Logger.trace("Work start working "+workerName);
        await setWorkerState(workerName, process.pid);
    }
    else
    {
        Logger.warn("Worker is occupied by PID@", isIdle);
        //Logger.warn("Gonna shoot worker@",isIdle);
        //process.kill(isIdle, 'SIGINT');
        //await setWorkerState(process.pid);
        return;
    }

    // var crawlers = ['listCrawler', 'detailCrawler', 'CTFileCrawler', 'CTDownloader', 'copyCrawler', 'doubanCrawler', 'doubanFastCrawler'];
    //var crawlers = ['listCrawler', 'detailFastCrawler', 'CTFileCrawler', 'CTDownloader'];
  //  var index = crawler_code%crawlers.length;
//	console.log(crawlers[index])
    //require(Configs.workingPath+crawlers[crawler_code]);
    const dler = require('./'+crawlers[crawler_code]);
    await dler.automate();
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

process.on('exit', async (code) => {
  Logger.info("process :"+process.pid);
  Logger.info(`About to exit with code: ${code}`);
  const workerName = process.argv[3];
  const crawler_code = (Number(process.argv[2])+1);
  if (crawler_code < crawlers.length )
  // if(crawler_code < Configs.greedy*Configs.crawlerStack && code != 9  && code!= 2)
  // if(code != 9 && code !=2)
  {
      require('child_process').fork(Configs.workingPath+'scheduler2.js',[crawler_code%crawlers.length, workerName] );
  }
  //await unsetWorkerState(workerName)

});

process.on('unhandledRejection', async (reason, promise) => {
  var message = ('Unhandled Rejection at:', promise, 'reason:', reason);
  Logger.error(message);
  //await unsetWorkerStateByPID(workerName)
  process.exit(0);
  // Application specific logging, throwing an error, or other logic here
});


(async () => {
    try {
      Logger.info("scheduler start dancing PID@"+process.pid);
      // const fs = require('fs');
      // var access = fs.createWriteStream(logfile);
      const crawler_code = Number(process.argv[2]);
      const workerName = process.argv[3];

      // process.stdout.write = process.stderr.write = access.write.bind(access);
      await schedule(workerName, crawler_code);
      Logger.info("scheduler finish dancing PID@"+process.pid);

    } catch (e) {
      Logger.error(e);
      throw(e);
    }
})();


