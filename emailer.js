const nodemailer = require('nodemailer');
const fs = require('fs');
const creds = require('./creds');
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
  port: 465,
  auth: {
    user: "marrowsky@126.com",
    pass: "ilove126"
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
  // var template = data+"";
  // template = '<p> template:' + template.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>") + '</p>';
    mailTransport.sendMail({
        sender: "marrowsky@126.com",
        to: 'mcpoet@126.com',
        subject: 'crawler.log',
        text: data+"?",
        contentType: 'text/plain',
        // html: template,
        attachments: [{'filename': logname, 'content': data}]

    }, function(err, success) {
        if (err) {
            // Handle error
            console.log(err);}
        });
    if(err)console.log(err);
  }

);
