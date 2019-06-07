
const fs = require('fs');
const mongoose = require('mongoose');

exports.injectCookiesFromFile =
async function(page, file)
{
    let cb = async function (page, cookie)
    {
        await page.setCookie(cookie); // method 2
    };

    fs.readFile(file, async function(err, data) {
        if(err)
            throw err;
        let cookies = JSON.parse(data);
        for (var i = 0, len = cookies.length; i < len; i++)
            await cb(page, cookies[i]); // method 2
    });
}

exports.assertMongoDB =
function ()
{
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Configs.dbUrl, { useNewUrlParser: true });
  }
}
