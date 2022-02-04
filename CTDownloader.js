const puppeteer = require('puppeteer');
const fs = require("fs");
//const { promises:{rm} } = require("fs");
const mongoose = require('mongoose');
const { DownloaderHelper } = require('node-downloader-helper');
const URL = require('url');
var urlencode = require('urlencode');
const process = require('process');
const Book = require('./models/book');
const LOG4JS = require('./logger');
const Logger = LOG4JS.downloaderLogger;
const StatsLogger = LOG4JS.stats_logger;
const CREDS = require('./creds');
const Configs = require('./configs');
const OSSPut = require('./saveToAliOSS');
const MAX_CRAWL_NUM = 200;
var exec = require('child_process').exec;

var statCount = 0;

async function assertMongoDB()
{
  if (mongoose.connection.readyState == 0) {
    //mongoose.connect( Configs.dbUrl, { useNewUrlParser: true });
    await mongoose.connect( Configs.dbUrl);
  }
}

async function closeMongoDB()
{
  if (mongoose.connection.readyState != 0) {
    //mongoose.connect( Configs.dbUrl, { useNewUrlParser: true });
    await mongoose.connection.close();
  }
}

async function updateBook(conditions, update) {
  await assertMongoDB();
  const query = Book.update(conditions, update, {});
  let r = await query.exec();
  await closeMongoDB();
  return r;
}

async function unsetCTDownloadUrl(download_url) {
  await assertMongoDB();
  /*if (mongoose.connection.readyState == 0) {
    mongoose.connect( Configs.dbUrl);
  }*/
  const conditions = { ctdownloadUrl: download_url };
  const options = {$unset:{ctdownloadUrl:1}};
  const query = Book.updateOne(conditions, options);
  let r = await query.exec();
  await closeMongoDB();
  return r;
}

async function downloadBook(bookObj)
{
    var dl_url = bookObj.ctdownloadUrl;
    var bookUrl = bookObj.bookUrl;
    var bookname = bookObj.bookName;
    var extension = bookObj.ext;
    extension = 'zip'
    console.log(dl_url)
	//if(extension == "" || extension == undefined)
    if(0)
    {	 
	    if(dl_url != null && dl_url!="")
	    {
	    	const url = new URL(dl_url);
		const pathname = url.pathname;
		const splitarray = pathname.split('.');
		const ext = splitarray[splitarray.length-1];
		    extension = ext;
	    }
	    else{
	        extension = bookObj.hasMobi?"mobi":"unknow";
	    }
    }
    bookname = bookname+"."+extension;
    if(dl_url != null && dl_url !="")
    {
      Logger.info("start downloading -> "+bookname+"\n"+dl_url);
      const dl = new DownloaderHelper(dl_url, Configs.workingPath+'books/downloading/', {fileName:bookname+".downing", override:true});

      dl.on('end', async () => {
        //should adding a verifying step
	var localPath = Configs.workingPath+'books/downloading/'+bookname+'.downing';
        var movePath = Configs.workingPath+'books/downloaded/'+bookname;
        var ossLocalPath = Configs.workingPath+'books/osslocal/'+bookname;
        var deleteLaterPath = Configs.workingPath+'books/deleteLater/'+bookname;
        var ossPath ='new_books/'+bookname; //should turn the .mobi to other format
        // 使用并行的方法，来处理1：入库；2：上传到阿里云，为了保证可以上传成功，尝试multipart的方式上传，并且可以有多个进程并行上传多个文件。
	fs.renameSync(localPath, movePath);
        var update = {downloaded:true,
                        ctdownloadTime:new Date(),
                        localPath:movePath
                      };
        var cond = {"ctdownloadUrl":dl_url};
        //await updateBook(cond,update);
	fs.copyFileSync(movePath, ossLocalPath);
	Logger.trace("Start uploading to OSS ... :"+ossLocalPath);
	//let p = await OSSPut.put(ossLocalPath, ossPath);

	let result = await OSSPut.putPromise(ossLocalPath, ossPath,{timeout:3600000});
	console.log(result);
        var stcode = result.res.status;
	if(stcode == 200)
	{      
		Logger.trace("OSS version uploaded DONE :"+ossLocalPath);
		var update = {savedToAliOSS:true,
                   		 aliOSSPath:result["url"]}
        	var cond = {"ctdownloadUrl":dl_url};
        	await updateBook(cond,update);
		fs.renameSync(ossLocalPath, deleteLaterPath);
	//	let err = await rm(ossLocalPath);
	//	if(err)
	//		Logger.error('removing oss local file error : '+err);
	}	

        statCount++;
        Logger.info("DONE downloading "+bookname);
	var bksize = Math.floor(bookObj.bookSize/1024/1024*100)/100;
        StatsLogger.info("Downloaded "+bookObj.cursorId+' '+bookname+' '+bksize+'M');
      });
      dl.on('error', async (err) => {
        Logger.error("Error ...");
        Logger.error(err);
        await unsetCTDownloadUrl(dl_url);
      });
      dl.on('stateChanged', (state) => {Logger.trace("Downloader State changed");Logger.trace(state);});
      dl.on('progress', (stats)=> {
	      var bksize = Math.floor(bookObj.bookSize/1024/1024*100)/100;
	      Logger.trace(bookname+" "+Math.floor(stats.progress)+"% "+Math.floor(stats.downloaded/1024/1024*100)/100+'M ('+bksize+'M)');
      });
      try {
        await dl.start();
      } catch (e) {
        Logger.error(e);
	      //await unsetCTDownloadUrl(dl_url);
      }
    }
}



function decodeBookName(urlstring)
{
  var slashs = urlstring.split("/");
  var dots = slashs[5].split(".")[0];
  var decoded = urlencode.decode(dots); // '苏千'
  // console.log(urlencode.parse(urlstring));
  // .pop().split(".").shift();
  return decoded;
}

async function assertBook() {
  await assertMongoDB();
  // const conditions = { "baiduUrl": {"$exists": false}} ;
  const conditions = { "$and":[
	  			{"ctdownloadUrl":{"$exists":true}}
	  			,{"ctdiskUrl2_code":{"$exists":true}}
	  			,{"ctdiskUrl2_code":{"$ne":'SLOW'}}
	  			,{"ctdiskUrl2_code":{"$ne":'FAST'}}
	  			//,{"overSized":{"$eq":false}}
  			]} ;
  const options = { limit:Configs.crawlStep, sort:{"cursorId":-1} };
  //const options = {  sort:{"cursorId":-1} };
  //const options = {  sort:{"bookSize":1} };
  var query = Book.find(conditions ,null ,options);
  const result = await query.exec();
  await closeMongoDB();
  return result;
}

var r = null;
//exports.automate = async function()
async function automate()
{
    r = await assertBook();
    StatsLogger.info(r.length+" books to be downloaded ...");
    // Logger.info(r);
    var limit = Configs.crawlStep;
    for (var i= 0; i < limit & i<r.length; i++)
    {
      	Logger.info("start download "+i);
      	book = r[i];
	    console.log(book);
      	Logger.trace(""+book.bookUrl);
	const dl_url = book.ctdownloadUrl;
	//const params = URL.parse(dl_url,true).query;
      	//var ts_now = parseInt(Date.now()/1000);
      	//var dll_ts = parseInt(params['ctt']);
	var bookSize = book['bookSize']/1024/1024;
	//if(bookSize > 50 )
	{
		console.log('oversized(in M) :'+bookSize)
        	var update = {overSized:true};
        	var cond = {"cursorId":book['cursorId']};
        	//await updateBook(cond,update);
	    	//continue;
	}
	//if(dll_ts < ts_now )
	    //continue;
	    await downloadBook(book);
    }
    if (mongoose.connection.readyState != 0) {
	 // await mongoose.connection.close();
    } 
    StatsLogger.info("CTDownloader Rate "+statCount+"/"+r.length);

}

/*
 main
*/

(async () => {
    try {
      Logger.info("CTDownloader Session START PID@"+process.pid);
      await automate();
      Logger.info("CTDownloader Session END PID@"+process.pid);
    } catch (e) {
      throw(e);
    }
})();
