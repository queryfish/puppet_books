const nodemailer = require('nodemailer');
const fs = require('fs');
const creds = require('./creds');
const process = require('process');
const Configs = require('./configs');

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


// mailTransport.sendMail(mailOptions, function(error, info){
//   if (error) {
//     console.log(error);
//   } else {
//     console.log('Email sent: ' + info.response);
//   }
// });

// const logfile = process.argv[2];

    mailTransport.sendMail({
        sender: "marrowsky@126.com",
        to: 'marrowsky_50@kindle.cn, mcpoet@126.com',
        subject: 'crawler.log',
        text: "?",
        contentType: 'text/plain',
        // html: template,
        attachments: [{filename: "test.mobi",
                      path: "./books/为什么我们总是在逃避.mobi"
                    }]}
        , function(err, success) {
                if (err) {
                  // Handle error
                  console.log(err);}
                });
