const OSS = require('ali-oss');
const mongoose = require('mongoose');
const Book = require('./models/book');

function assertMongoDB() {
  if (mongoose.connection.readyState == 0) {
    mongoose.connect( Config.dbUrl);
  }
}

const client = new OSS({
  region: 'oss-cn-beijing',
  //云账号AccessKey有所有API访问权限，建议遵循阿里云安全最佳实践，部署在服务端使用RAM子账号或STS，部署在客户端使用STS。
  accessKeyId: 'LTAIiSA7Yhhu4fCZ',
  accessKeySecret: 'YTmzNXyhnPZKdGl1ZBcXcAKuGs4IUW',
  bucket: 'stephen-s-bookstore'
});

(async ()=>{
  // try {
    await downloadlist();
  // } catch (e) {
    // console.log(e);
  // } finally {
  // }

})();

async function downloadlist()
{
    var my_marker = "";
    var should_break = false;
    var max_loop = 0;
    while (max_loop < 20)
    {

        let result = await
        client.list({
          "prefix": 'books/',
          "max-keys":2,
          "marker":my_marker
        });
            if(result.objects == null || result.objects.length == 0)
            {
                console.log('not found book :');
                console.log(result.res.requestUrls)
                console.log(decodeURI(result.res.requestUrls[0]))
                return ;
            }

            if(result.nextMarker == null || result.nextMarker == undefined)
              break;
            else
            {
              my_marker = result.nextMarker;
              console.log('nextMaker : '+my_marker);
              max_loop++;
            }
            console.log('objects: '+ result.objects.length);
            for (var i = 0; i < result.objects.length; i++) {
               var b  = result.objects[i];
               var path = b.name;
               var spliti = path.split('/');
               var filename = spliti[1];
               if(spliti.length <= 1 || spliti[1] == '')
                    continue;
               else {
                 var ossPath = path;
                 var localPath = './tmp/'+filename;
                 console.log('getting file +'+filename);
                 let r = await client.get(ossPath,localPath);
                 console.log('DONE with -> ', filename);
               }
            }
    }
}
