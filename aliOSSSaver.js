const OSS = require('ali-oss');

const client = new OSS({
  region: 'oss-cn-beijing',
  //云账号AccessKey有所有API访问权限，建议遵循阿里云安全最佳实践，部署在服务端使用RAM子账号或STS，部署在客户端使用STS。
  accessKeyId:'LTAI4GJFGjPc5nTz4fvKp64y',
  accessKeySecret:'uEwFR131y2MUD0qnmmsnXmIbVpzteN',
  bucket: 'stephen-s-bookstore'
});

//exports.put =
async function put(localfile) {
  try {
    // object表示上传到OSS的Object名称，localfile表示本地文件或者文件路径
    let r1 = await client.put(localfile,localfile);
    console.log('put success: %j', r1);
	  //if success , move the file to some other archieve of even just remove it .:
    return 0;
    // let r2 = await client.get('object');
    // console.log('get success: %j', r2);
  } catch(e) {
    // console.error('error: %j', e);
    console.log(e);
    return 1;
  }
}

async function get() {
  try {
    // object表示上传到OSS的Object名称，localfile表示本地文件或者文件路径
    let r1 = await client.get('test/test.mobi','./books/test2.mobi');
    console.log('put success: %j', r1);
    // let r2 = await client.get('object');
    // console.log('get success: %j', r2);
  } catch(e) {
    // console.error('error: %j', e);
    console.log(e);
  }
}

(async () => {
    try {
      // const fs = require('fs');
      // var access = fs.createWriteStream(logfile);
      const local = (process.argv[2]);
      //await schedule(crawler_code);
      await put(local);

    } catch (e) {
      throw(e);
    }
})();
