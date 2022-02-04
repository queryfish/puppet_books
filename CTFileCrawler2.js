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
const url = require('url');

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

async function setupPageClient(page)
{

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36');
	await page.setRequestInterception(true);
  page.on('request', request => {
	            console.log('GOT NEW REQUEST', request.url());
	            request.continue();
	        });

    await page._client.send('Page.setDownloadBehavior', {
          behavior: 'deny'
        });
  page.on('response', response => {
	  	const heads = response.headers();
			            console.log('GOT NEW RESPONSE', response.status(), response.headers());
	  				if(response.status() == 302 && heads['location'] != null)
		  				console.log('we get the dir link '+heads['location']);
			        });
// intercept request when response headers was received
/* 
  const client = await page.target().createCDPSession();
client.send('Network.setRequestInterception', {
    patterns: [{
        urlPattern: '*',
        resourceType: 'Document',
        interceptionStage: 'HeadersReceived'
    }],
  });
*/
/*
  await client.on('Network.requestIntercepted', async e => {
      let headers = e.responseHeaders || {};
      console.log(headers);
      let contentType = headers['content-type'] || headers['Content-Type'] || '';
      let obj = {interceptionId: e.interceptionId};
      if (contentType.indexOf('application/zip') > -1) {
          obj['errorReason'] = 'BlockedByClient';
      }
      await client.send('Network.continueInterceptedRequest', obj);
  });

    await page.on('response', async response => {
        // If response has a file on it
//	    console.log(response._headers);
        if (response._headers['content-disposition'] === 'attachment') {
           // Get the size
           var bookSize = Number(response._headers['content-length']);
	   var bookSize_m = bookSize/1024/1024 > 50 ;
           var download_url =response._url;
           Logger.trace('BOOK Size : '+ bookSize);
           Logger.info("DOWNLOAD URL CATCHED!!");
        }
    });

*/
}

async function fillcode(page, codeUrl, code)
{
     //const CHECKCODE_SELECTOR  = '#passcode';
     //const BUTTON_SELECTOR  = '#main-content > div > div.row.flex-center.pt-6.text-center > div > div > div > div:nth-child(4) > div:nth-child(2) > button';
     const CHECKCODE_SELECTOR  = '#pwd';
     const BUTTON_SELECTOR  = '#sub'
     Logger.trace("the code is:"+code);
     await page.goto(codeUrl, {waitUntil: 'networkidle2', timeout:0,});
     let no_checkcode = await page.evaluate(() => {
        const CHECKCODE_SELECTOR  = '#pwd';
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
     await page.waitFor(5*1000);
}


async function fetchBook(bookUrl, book, page)
{

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36');
  const client = await page.target().createCDPSession();
/*
  client.send('Network.setRequestInterception', {
    patterns: [{
        urlPattern: '*',
        resourceType: 'Document',
        interceptionStage: 'HeadersReceived'
    }],
  });
*/
  await client.on('Network.requestIntercepted', async e => {
      	let headers = e.responseHeaders || {};
      	let contentType = headers['content-type'] || headers['Content-Type'] || '';
     	console.log(headers);
	let obj = {interceptionId: e.interceptionId};
      	if (contentType.indexOf('application/zip') > -1) {
          	obj['errorReason'] = 'BlockedByClient';
      	}
      	await client.send('Network.continueInterceptedRequest', obj);
  });


    await page._client.send('Page.setDownloadBehavior', {
          behavior: 'deny'
    });
    
    await page.on('response', async response => {
	console.log('response ---------------------------------------');
	var ct = response._headers['content-type'];
	console.log(response._headers);
	if (ct === 'application/zip' 
			|| ct ==='application/octet-stream' 
			|| ct ==='application/epub+zip' )
	{
		var bookSize = Number(response._headers['content-length']);


	}
    });
    await page.goto(bookUrl, {waitUntil: 'networkidle2', timeout:0,});
    await page.waitFor(30*1000);

}


async function fake_fetchBookDir(sobookUrl, bookObj)
{
  	const browser = await puppeteer.launch({
     		headless: true,
      		ignoreHTTPSErrors: true,
      		defaultViewport: null
  	});
  	// Download and wait for download
  	const page = await browser.newPage();
  	const bookUrl = bookObj["ctdiskUrl2"];
	const code = bookObj.ctdiskUrl2_code;
  	await fillcode(page, bookUrl, code);
	// And NOW we are here at the file list page
	console.log('filling good');
	const file_list_sel = '#name > a';
	const book_name_sel = '#sp_name';
	const dl_page_href = await page.$eval(file_list_sel, h => h.getAttribute('href'));
	//TODO:
	const dl_page_url = 'https://sobooks.lanzouo.com'+dl_page_href;

	await fetchBook(dl_page_url, bookObj, page);
    	await browser.close();
}	

async function fetchBookDir(sobookUrl, bookObj)
{
  	const browser = await puppeteer.launch({
     		headless: true,
      		ignoreHTTPSErrors: true,
      		defaultViewport: null
  	});
  	// Download and wait for download
  	const page = await browser.newPage();
  	const bookUrl = bookObj["ctdiskUrl2"];
	const code = bookObj.ctdiskUrl2_code;
  	await fillcode(page, bookUrl, code);
	// And NOW we are here at the file list page
	console.log('filling good');
	const file_list_sel = '#name > a';
	const book_name_sel = '#sp_name';
	const dl_page_href = await page.$eval(file_list_sel, h => h.getAttribute('href'));
	//TODO:
	const dl_page_url = 'https://sobooks.lanzouo.com'+dl_page_href;
	
	console.log('going to '+dl_page_url+'...');
  	await page.goto(dl_page_url, {waitUntil: 'networkidle2', timeout:0,});
  	await page.waitFor(5*1000);
  	//TODO	
	const frame = page.frames()[1];
	console.log(frame.url());
  	const href_sel = '#go > a';
  	//This should be the click
	//TODO: the Browser should be setup ready before this.
//	await setupPageClient(page)
	const ser = await frame.$eval(href_sel, h => h.getAttribute('href'));
	console.log('WE GOT IT ->\n'+ser);
	//click the button
	/*
	  await page._client.send('Page.setDownloadBehavior', {
		        behavior: 'allow',
		        downloadPath: './books/' 
		    });

	  await page._client.on('Page.downloadWillBegin', ({ url, suggestedFilename }) => {
		      console.log('download beginning,', url, suggestedFilename);
		      fileName = suggestedFilename;
		    });

	  await page._client.on('Page.downloadProgress', ({ state }) => {
		      if (state === 'completed') {
			            console.log('download completed. File location: ');
			          }
		    });
	
	*/
  	page.on('response',  response => {
		const heads = response.headers();
		console.log('GOT NEW RESPONSE', response.status(), response.headers());
	  	if(response.status() == 302 && heads['location'] != null)
		{  	
			console.log('we get the dir link '+heads['location']);
			bookObj['ctdownloadUrl'] = heads['location'];
			//await upsertBook(bookObj);	
		}
	});
	
	headers2 = {
		    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:66.0) Gecko/20100101 Firefox/66.0',
		    'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
	}
	headers3 = {
		    'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
	}
  	await page.setExtraHTTPHeaders(headers2);
	try{
	  await page.goto(ser, {waitUntil: 'networkidle2', timeout:0,});
	} catch(err){
		Logger.error(err.message);	
    		await browser.close();
  		return ;
	}
	//const dl_button = await frame.click(href_sel);
  	//await page.waitFor(40*1000);
    	await browser.close();
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
  const conditions = { "$and":[{"ctdiskUrl2": {"$exists": true}}
                              ,{"ctdiskUrl2":{"$ne":"NONE"}}
                              ,{"ctdiskUrl2_code":{"$exists":true}}
                              ,{"ctdiskUrl2_code":{"$ne":'SLOW'}}
                              ,{"ctdiskUrl2_code":{"$ne":'FAST'}}
			      //,{"ctdownloadUrl":{"$exists":false}}
                             ]
                     } ;
  const downloadConditions = {
	  "$and":[{"ctdownloadUrl":{"$exists":true} }
		  ,{"downloaded":{"$exists":false}}
                  ,{"overSized":{"$eq":false}}
	  ]
  };
  const options = { limit: Configs.crawlStep , sort:{"cursorId": -1} };
  //const options = { sort:{"cursorId": -1} };
  var dl_query = Book.find(downloadConditions ,null ,options);
  var query = Book.find(conditions ,null ,options);
  //const dl_result = await dl_query.exec();
  //StatsLogger.info("CTFileCrawler "+dl_result.length+" books to be Downloaded ...");
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
      Logger.error('Main from Error:\n'+e);
      mongoose.connection.close();
      return;
    }

})();
