const nodemailer = require('nodemailer');
const fs = require('fs');
const creds = require('./creds');
const process = require('process');
const Config = require('./configs');
const mongoose = require('mongoose');
const Book = require('./models/book');


var mailOptions = {
  from: 'marrowsky@126.com',
  to: 'mcpoet@126.com',
  subject: 'Sending Email using Node.js',
  text: 'That was easy!'
};

var mailTransport = nodemailer.createTransport({
  host: 'smtp.126.com',
  secure: true,
  port: 465,
  auth: {
    user: "marrowsky@126.com",
    pass: "fucking126"
  }
});

function assertMongoDB() {
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Config.dbUrl, {useNewUrlParser: true, poolSize:4});
  }
}

async function assertBook4() {
  assertMongoDB();
  var datetime = require('node-datetime');
  var end = new Date();
  var start = new Date(end.getTime() - (1000*60*60));

  const conditions = {$and :[
    {"doubanCrawlDate":{"$gte":start}},
    {"doubanCrawlDate":{"$lte":end}}
  ]}
  const options = { limit:5 };
  var query = Book.find(conditions ,'bookSerial' ,null);
  const result = await query.exec();
  var content = "crawled "+result.length+" books during \n\n"+start +"\n"+end;
  mongoose.connection.close();
  return content;
}

(async () => {
    try {
      let content = await assertBook4();
      mailTransport.sendMail({
          sender: "marrowsky@126.com",
          to: 'mcpoet@126.com',
          subject: 'doubanCrawler.log',
          text: content+"-_-",
          contentType: 'text/plain'

      }, function(err, success) {
          if (err) {
              console.log(err);}
          });

    } catch (e) {
      console.log(e);
      throw(e);
    }
})();

// fs.readFile(statfile, function (err, data) {
