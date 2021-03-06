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
var datetime = require('node-datetime');
var today = new Date();
var hourago = new Date(today.getTime() - (1000*60*60));
// var hourago = new Date(today.getTime());
var formatted = datetime.create(hourago).format('YmdH');
const logfile = Configs.workingPath+'logs/hourly.'+formatted+'.log';
const statfile = Configs.workingPath+'logs/stats.'+formatted+'.log';

//make sure the log file exist
console.log(logfile);

fs.readFile(statfile, function (err, data) {
    mailTransport.sendMail({
        sender: "marrowsky@126.com",
        to: 'mcpoet@126.com',
        subject: 'crawler.log',
        text: data+"?",
        contentType: 'text/plain',
        // html: template,
        attachments: [{filename: "tracing.txt",
                      path: logfile
                    }]

    }, function(err, success) {
        if (err) {
            // Handle error
            console.log(err);}
        });
    if(err)console.log(err);
  }

);
