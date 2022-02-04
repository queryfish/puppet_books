const puppeteer = require('puppeteer');
const fs = require('fs');
const mongoose = require('mongoose');
const process = require('process');
const Book = require('./models/book');
const LOG4JS = require('./logger');
const Logger = LOG4JS.download_logger;
const StatsLogger = LOG4JS.stats_logger;
const CREDS = require('./creds');
const Configs = require('./configs');

var statCount = 0;

async function upsertBook(bookObj) {
  assertMongoDB();
  // if this email exists, update the entry, don't insert
  const conditions = { bookUrl: bookObj.bookUrl };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  var query = Book.findOneAndUpdate(conditions, bookObj, options);
  const result = await query.exec();
  return ;
}

async function getSelectorHref(page, selector) {
  let tc = await page.evaluate((sel) => {
    if(document.querySelector(sel) != null){
      let baidu_url = document.querySelector(sel).getAttribute("href");
	return baidu_url;
    }
    else
      return null;
  }, selector);
  return tc;
}

async function getTextContent(page, selector) {
  let tc = await page.evaluate((sel) => {
    if(document.querySelector(sel) != null)
      return document.querySelector(sel).textContent;
    else
      return null;
  }, selector);
  return tc;
}

async function fetchBook(sobookUrl, bookUrl)
{

  const browser = await puppeteer.launch({
    headless: false,
      ignoreHTTPSErrors: true,
    defaultViewport: null
  });
  // Download and wait for download
  const page = await browser.newPage();
  // await injectCookiesFromFile(page, Configs.cookieFile);
  // await page.waitFor(5 * 1000);
  const client = await page.target().createCDPSession();

// intercept request when response headers was received
  client.send('Network.setRequestInterception', {
    patterns: [{
        urlPattern: '*',
        resourceType: 'Document',
        interceptionStage: 'HeadersReceived'
    }],
  });

  await client.on('Network.requestIntercepted', async e => {
      let headers = e.responseHeaders || {};
      let contentType = headers['content-type'] || headers['Content-Type'] || '';
      let obj = {interceptionId: e.interceptionId};
      if (contentType.indexOf('application/zip') > -1) {
          obj['errorReason'] = 'BlockedByClient';
	      console.log(headers);
      }
      await client.send('Network.continueInterceptedRequest', obj);
  });

  var isBrowserClosed = false;
  await browser.on( 'disconnected', async ()=>{
      Logger.trace('Browser is closed');
      isBrowserClosed = true;
  });

  // await page.goto(bookUrl, {waitUntil: 'load'});
  // await page.goto(bookUrl);
  await page.goto(bookUrl, {waitUntil: 'networkidle2', timeout:0,});
  await page.waitFor(5*1000);

  var is_mobi_page = false;
  const BOOK_FILE_SEL = '#page-content > div.page-header.position-relative > div > div.pull-left > h3';
  const BOOK_NAME = '#table_files > tbody > tr > td:nth-child(2) > a'
  let book_file_name = await getTextContent(page, BOOK_NAME);
  Logger.trace('resolved book name'+ book_file_name);
  // if(book_file_name !=null && book_file_name.indexOf(".mobi")>0)
  // {
  //     Logger.info(book_file_name+" Direct Page Found");
  //     is_mobi_page = true;
  // }

  if(is_mobi_page)
  {
    const DL_BUTTON = '#free_down_link';
    // await page.waitFor(5*1000);//会有找不到输入框的异常，加上一个弱等待试试
    // let download_href = await getSelectorHref(page, BOOK_SEL);
    await page._client.send('Page.setDownloadBehavior', {
          behavior: 'deny'
        });
    // page.click(BOOK_SEL);
    // await page.goto(download_href, {waitUntil: 'load'});
    await page.on('response', async response => {
        // If response has a file on it
        if (response._headers['content-disposition'] === 'attachment') {
           // Get the size
           var bookSize = Number(response._headers['content-length']);
	   var bookSize_m = bookSize/1024/1024 > 50 ;
           var download_url =response._url;
           Logger.trace('BOOK Size : '+ bookSize);
           Logger.info("DOWNLOAD URL CATCHED!!");
           // save url to DB for later download workers.
           await upsertBook({"bookUrl":sobookUrl,
                             "ctdownloadUrl":download_url,
                             "bookSize":bookSize,
                             "hasMobi": bookSize_m
                           });
           statCount ++;
           await browser.close();
           //statLogger();
           // var child = require('child_process').fork(Configs.workingPath+'CTDownloader.js',[download_url] );
           // await CTDownloader.downloadBook(download_url);
        }
    });

    await page.click(DL_BUTTON);
    await page.waitFor(10*1000);
    // set timeout to close a browser for leak provention
    // await browser.close();
    // setTimeout(()=>{ await browser.close() }, 2*, 'funky');
    Logger.trace("About to exit the CTFileCrawl mini Session");
  }
  else{
    //we can do more than HAS MOBI
    await upsertBook({"bookUrl":sobookUrl,
                      "hasMobi":false
                    });
    //should mark the book as mobi-less version
  }
  if(isBrowserClosed == false)
  {
    Logger.info("FORCING browser to close.");
    await browser.close();
  }

  return ;

}

async function fillcode(page, codeUrl, code)
{
     const CHECKCODE_SELECTOR  = '#passcode';
     const BUTTON_SELECTOR  = '#main-content > div > div.row.flex-center.pt-6.text-center > div > div > div > div:nth-child(4) > div:nth-child(2) > button';
     //const CHECKCODE_SELECTOR  = '#pwd';
     //const BUTTON_SELECTOR  = '#sub'
     //Logger.trace("the code is:"+code);
     await page.goto(codeUrl, {waitUntil: 'networkidle2', timeout:0,});
     let no_checkcode = await page.evaluate(() => {
        const CHECKCODE_SELECTOR  = '#passcode';
  	let el = document.querySelector(CHECKCODE_SELECTOR)
  	return el==null;
     })
     if (no_checkcode==true)
	return;
     await page.click(CHECKCODE_SELECTOR);
     await page.keyboard.type(code);
     //await page.keyboard.type(CREDS.download_code);
     await page.click(BUTTON_SELECTOR);
     // await page.click(BUTTON_SELECTOR).then(() => page.waitForNavigation({waitUntil: 'load'}));
     await page.waitFor(10*1000);
}

const url = require('url');



async function fetchBookDir(sobookUrl, bookObj)
{

  const browser = await puppeteer.launch({
      headless: true,
      ignoreHTTPSErrors: true,
      defaultViewport: null
  });
  // Download and wait for download
  const page = await browser.newPage();
  const bookUrl = bookObj["ctdiskUrl"];
  await fillcode(page, bookUrl, '666888');
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36');
  // await injectCookiesFromFile(page, Configs.cookieFile);
  // await page.waitFor(5 * 1000);
  const client = await page.target().createCDPSession();

// intercept request when response headers was received
  client.send('Network.setRequestInterception', {
    patterns: [{
        urlPattern: '*',
        resourceType: 'Document',
        interceptionStage: 'HeadersReceived'
    }],
  });

  await client.on('Network.requestIntercepted', async e => {
      let headers = e.responseHeaders || {};
      let contentType = headers['content-type'] || headers['Content-Type'] || '';
      let obj = {interceptionId: e.interceptionId};
      if (contentType.indexOf('application') > -1) {
      //    obj['errorReason'] = 'BlockedByClient';
      	    //Logger.info(e);
      }
      await client.send('Network.continueInterceptedRequest', obj);
  });

  var isBrowserClosed = false;
  await browser.on( 'disconnected', async ()=>{
      Logger.trace('Browser is closed');
      isBrowserClosed = true;
  });

	Logger.trace('book ctdisk Url:'+bookUrl);
  await page.goto(bookUrl, {waitUntil: 'networkidle2', timeout:0,});
  await page.waitFor(5*1000);
  const BOOK_SEL = '#table_files > tbody > tr:nth-child(INDEX) > td:nth-child(2) > a';
  const BOOK_NAME = '#table_files > tbody > tr > td:nth-child(2) > a';
	var extension = "";
  var download_href = "";
	var formats = [];
	var download_pages = [];
  for (var i = 1; i < 4; i++) {
     	let booknameSelector = BOOK_SEL.replace("INDEX", i);
     	if (await page.$(booknameSelector) != null)
     	{
        	let bookname = await getTextContent(page, booknameSelector);
        	// var format = bookname.split('.').pop();
        	//Logger.trace("trying to find the format url for "+bookname);
        	if(bookname !=null)
        	{
                	Logger.info(bookname+" Found");
            		a = bookname.split(".");
            		booktype = a[a.length-1];
			formats.push(booktype.toLowerCase());
			let page_url = await getSelectorHref(page, booknameSelector);
			download_pages.push(page_url);
		}
     	}	
   }
	const format_seq = ['epub', 'zip','mobi', 'azw3']
	for (var i =0; i<format_seq.length;i++)
	{
		var index = formats.indexOf(format_seq[i])
		if(index >= 0 )
		{ 
			extension=formats[index];
			download_href=download_pages[index];
                	Logger.info("Format found"+ extension +' @'+download_href);
			break;
		}
	}
  
	if(download_href.length > 0){
    	const DL_BUTTON = '#main-content > div > div > div:nth-child(5) > div:nth-child(1) > div.card-body.position-relative > button';
    	var current_url = page.url();
    	var site_name = url.parse(current_url, true);
	  //console.log("page's url :->"+page.url());
    	download_href = "https://"+site_name.host + download_href;
    	await page._client.send('Page.setDownloadBehavior', {
          behavior: 'deny'
        });
    	// page.click(BOOK_SEL);
    	// await page.goto(download_href, {waitUntil: 'load'});
    	await page.on('response', async response => {
        // If response has a file on it
	var ct = response._headers['content-type'];
	    //'application/epub+zip'
		if (ct === 'application/zip' 
		|| ct ==='application/octet-stream' 
		|| ct ==='application/epub+zip' 
		)
		{
		//if (ct.indexOf('application/zip')>-1) {
           	// Get the size
	   	// const text = await response.text();
           var bookSize = Number(response._headers['content-length']);
	   var overSized = bookSize/1024/1024 > 50 ;
           var download_url =response._url;
           Logger.info("DOWNLOAD URL CATCHED!!");
           Logger.trace(download_url);
           // save url to DB for later download workers.
           await upsertBook({"bookUrl":sobookUrl,
                             "ctdownloadUrl":download_url,
                             "bookSize":bookSize,
		   	     "ext":extension,
		   	     "overSized":overSized,
		   	     "lastCrawlCopyTime": new Date()
                           });
           statCount ++;
           await browser.close();
    	   StatsLogger.info("CTFileCrawler catch: "+bookObj.cursorId +" "+bookObj.bookName);
           //statLogger();
           // var child = require('child_process').fork(Configs.workingPath+'CTDownloader.js',[download_url] );
           // await CTDownloader.downloadBook(download_url);
        	}
    	});
	  Logger.trace("download info: "+download_href);
    await page.goto(download_href, {waitUntil: 'networkidle2', timeout:0,});
    //await page.waitFor(5*1000);//会有找不到输入框的异常，加上一个弱等待试试
    await page.click(DL_BUTTON);
    await page.waitFor(20*1000);
    // set timeout to close a browser for leak provention
    // await browser.close();
    // setTimeout(()=>{ await browser.close() }, 2*, 'funky');
    Logger.trace("About to exit the CTFileCrawl mini Session");
  	}
  	else
  	{
		var err = bookObj['ctError']?book['ctError']:0;
	  	await upsertBook({"bookUrl":sobookUrl,
                      "ctError":++err
                    });
	  	//should mark the book as mobi-less version
  	}
  if(isBrowserClosed == false)
  {
    Logger.info("FORCING browser to close.");
    await browser.close();
  }

  return ;

}

function assertMongoDB()
{
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Configs.dbUrl);
  }
}

async function assertBook() {
  assertMongoDB();
  // const conditions = { "baiduUrl": {"$exists": false}} ;
  const conditions = { "$and":[{"ctdiskUrl": {"$exists": true}}
                              ,{"ctdiskUrl":{"$ne":"NONE"}}
                              ,{"overSized":{"$exists":false}}
                              ,{"ctError":{"$exists":false}}
                               ,{ "$or":[
				       {"ctdownloadUrl":{"$exists":false}}
				       ,{"ctdownloadUrl":{"$eq":null}}
			       ]}
                             ]
                     } ;
  const downloadConditions = {
	  "$and":[{"ctdownloadUrl":{"$exists":true} }
		  ,{"downloaded":{"$exists":false}}
                  ,{"overSized":{"$eq":false}}
	  ]
  };
  //const options = { limit: Configs.crawlStep , sort:{"cursorId": -1} };
  const options = { sort:{"cursorId": -1} };
  var dl_query = Book.find(downloadConditions ,null ,options);
  var query = Book.find(conditions ,null ,options);
  const dl_result = await dl_query.exec();
  StatsLogger.info("CTFileCrawler "+dl_result.length+" books to be Downloaded ...");
  //if(dl_result.length > 10) 
//	return [];
  const result = await query.exec();
  console.log(result);
  return result;
}

// exports.run =
async function automate() {
  /*
  1- query from mongodb for impartial entry to be further crawl for detail
  2- use the crawl func and save it to db
  3- stop when MAX_CRAWL_NUM exceed or the db is out of candidate
  */
    var r = await assertBook();
    if(r.length > 0)
	StatsLogger.info(r.length+" books to be CTed ...");
    const limit = Configs.crawlStep;
    for (var i = 0; i < r.length; i++)
    {
      book = r[i];
      Logger.trace("NO. "+i+" book: "+book.bookName);
      var book_url  = book.ctdiskUrl;
      //Should be before this function
      var split = book_url.split('/');
      // if(split[3] == 'dir'){
      //   await fetchBookDir(book.bookUrl, book.ctdiskUrl);
      // }
      // else if(split[3] == 'fs')
      {
        //Logger.trace('gonna go :'+book_url);
        //await fetchBookDir(book.bookUrl, book.ctdiskUrl);
        var code = book.ctdiskUrl2_code;
	Logger.trace("Book Url :"+book.bookUrl);
	await fetchBookDir(book.bookUrl, book)
      }
    }
    if(r.length > 0)
    	StatsLogger.info("CTFileCrawler catch rate :"+statCount+"/"+r.length);
}

/*
 main
*/
(async () => {
    try {
      //Logger.info("CTFileCrawler Session roll out PID: ", process.pid);
      await automate();
      mongoose.connection.close();
      //Logger.info("CTFileCrawler Session END PID: ", process.pid);
      // as the CTFileCrawler often STALLED for the sake of FileDownloading Async Calls
      // we should check it to kill itself and children as well.
      // NOTE!!! Such way works, the scheduler should not shoot the Jammer.
      // Logger.warn("And I should kill myself here and now @"+process.pid);
      // process.kill(process.pid, "SIGINT");

    } catch (e) {
      Logger.error('we got an ERROR \n'+e.Error());
      //throw(e);
      mongoose.connection.close();
      return;
    }

})();
