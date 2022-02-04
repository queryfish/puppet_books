const puppeteer = require('puppeteer');
//const CREDS = require('./creds');
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
  //sleep(2000);
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
  const updates = {"workerState":workerState};
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };

  const query = crawlerConfig.findOneAndUpdate(conditions, updates, options);
  let ret = await query.exec();
  await mongoose.connection.close();
  return ret;

}

const crawlers = ['listCrawler','detailFastCrawler','detailCrawler', 'CTFileCrawler'];
var crawler_group_index = 0;
var crawler_group_span = crawlers.length;

async function schedule(crawler_index, crawler_span)
{
    let isIdle = await isWorkerIdle();
    // if idle returns 0, or else return the worker PID which occupied
    if(isIdle == 0)
    {
        await setWorkerState(process.pid);
    }
    else
    {
        Logger.warn("Worker is occupied by PID@", isIdle);
        //Logger.warn("Gonna shoot worker@",isIdle);
        process.kill(isIdle, 'SIGINT');
        await setWorkerState(process.pid);
        //return;
    }

    if(crawler_index + crawler_span <= crawlers.length && crawler_index >= 0)
    	require('./'+crawlers[crawler_index]);
}

process.on('uncaughtException', (err, origin) => {
  // fs.writeSync(
  console.log(
    process.stderr.fd,
    `Caught exception: ${err}\n` +
    `Exception origin: ${origin}`
  );
   process.exit(0);
});

// var datetime = require('node-datetime');
// var formatted = datetime.create().format('Ymd_HMS');
// const logfile = Configs.workingPath+'logs/'+formatted+'.log';

process.on('exit', (code) => {
  Logger.trace("PID@"+process.pid+" exit with code:"+ code);
  Logger.trace("--------------------------------------------------------------------");
  const crawler_code = crawler_group_index + 1;
  const group_len = crawler_group_span - 1;
	console.log("index : "+crawler_code+", span:"+group_len);
  if (group_len > 0 && crawler_code < crawlers.length)
  // if(crawler_code < Configs.greedy*Configs.crawlerStack && code != 9  && code!= 2)
  // if(code != 9 && code !=2)
  {
      require('child_process').fork(Configs.workingPath+'scheduler.js',[crawler_code, group_len] );
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
      	Logger.trace("--------------------------------------------------------------------");
      	Logger.trace("scheduler start  PID@"+process.pid);
      	//const crawler_group_index =  0;
      	//const crawler_group_span = crawlers.length;
      	if(process.argv.length >= 3)
      		crawler_group_index =  Number(process.argv[2]);
	if(process.argv.length >= 4)
      		crawler_group_span = Number(process.argv[3]);
	
	await schedule(crawler_group_index, crawler_group_span);

    } catch (e) {
      Logger.error(e);
      throw(e);
    }
})();
