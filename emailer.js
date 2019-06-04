var nodemailer = require('nodemailer');
var fs = require('fs');

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
    user: '',
    pass: ''
  }
});

mailTransport.sendMail(mailOptions, function(error, info){
  if (error) {
    console.log(error);
  } else {
    console.log('Email sent: ' + info.response);
  }
});

// fs.readFile("./社会工程.mobi", function (err, data) {
//     mailTransport.sendMail({
//         sender: 'marrowsky@126.com',
//         to: 'marrowsky_50@kindle.cn, mcpoet@126.com',
//         subject: 'Attachment!',
//         body: 'mail content...',
//         attachments: [{'filename': 'temp.mobi', 'content': data}]
//     }, function(err, success) {
//         if (err) {
//             // Handle error
//             console.log(err);}
//         });
//     if(err)console.log(err);
//   }
//
// );
