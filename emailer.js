var nodemailer = require('nodemailer');
var fs = require('fs');
var creds = require('./creds');
const process = require('process');

var mailOptions = {
  from: 'marrowsky@126.com',
  to: 'mcpoet@126.com',
  subject: 'Sending Email using Node.js',
  text: 'That was easy!'
};

var mailTransport = nodemailer.createTransport({
  host: 'smtp.126.com',
  secure: true,
  port: 994,
  auth: {
    user: creds.mailuser,
    pass: creds.mailpass
  }
});


// mailTransport.sendMail(mailOptions, function(error, info){
//   if (error) {
//     console.log(error);
//   } else {
//     console.log('Email sent: ' + info.response);
//   }
// });

const logfile = process.argv[2];

fs.readFile(logfile, function (err, data) {
  var logname = logfile.split("/").pop();
    mailTransport.sendMail({
        sender: creds.mailuser,
        to: 'mcpoet@126.com',
        subject: 'crawler.log',
        body: data+"?",
        attachments: [{'filename': logname, 'content': data}]

    }, function(err, success) {
        if (err) {
            // Handle error
            console.log(err);}
        });
    if(err)console.log(err);
  }

);
