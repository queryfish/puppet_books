const puppeteer = require('puppeteer');
const fs = require('fs');
const mongoose = require('mongoose');
const { DownloaderHelper } = require('node-downloader-helper');
var urlencode = require('urlencode');
const process = require('process');
const Book = require('./models/book');
const LOG4JS = require('./logger');
const Logger = LOG4JS.download_logger;
const StatsLogger = LOG4JS.stats_logger;
const CREDS = require('./creds');
const Configs = require('./configs');
const MAX_CRAWL_NUM = 200;

var statCount = 0;
function upsertBook(bookObj) {
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Configs.dbUrl);
  }
  const conditions = { bookUrl: bookObj.bookUrl };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  Book.findOneAndUpdate(conditions, bookObj, options, (err, result) => {
    if (err) {
      throw err;
    }
  });
}

function assertMongoDB()
{
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Configs.dbUrl, { useNewUrlParser: true });
  }
}

function thisHour() {
  var here = new Date();
  var year = here.getFullYear();
  var month = here.getMonth();
  var day = here.getDate();
  var hour = here.getHours();
  return new Date(year, month, day, hour);
}

function lastHour() {
  var here = new Date();
  var year = here.getFullYear();
  var month = here.getMonth();
  var day = here.getDate();
  var hour = here.getHours()-1;
  return new Date(year, month, day, hour);
}

async function assertBook() {
  assertMongoDB();
  // const conditions = { "baiduUrl": {"$exists": false}} ;
  var startTime = lastHour();
  var endTime = thisHour();
  console.log(startTime.toISOString());
  console.log(endTime.toISOString());

  var condition  =
      {$and : [
          {'ctdownloadTime': { $lte: endTime.toISOString() }},
          {'ctdownloadTime':{ $gte: startTime.toISOString()}},
            {'downloaded':true} ]
      };

  var query = Book.find(condition ,null ,null);
  const result = await query.exec();
  return result;
}

async function automate()
{
    var r = await assertBook();
    StatsLogger.info(r.length+" books downloaded ...");
    console.log(r);

}

/*
 main
*/

(async () => {
    try {
      Logger.info("CTDownloader Session START PID@"+process.pid);
      await automate();
      mongoose.connection.close();
      Logger.info("CTDownloader Session END PID@"+process.pid);
    } catch (e) {
      throw(e);
    }
})();
