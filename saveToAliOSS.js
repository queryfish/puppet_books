let OSS = require('ali-oss');

let client = new OSS({
  region: 'oss-cn-beijing',
  //云账号AccessKey有所有API访问权限，建议遵循阿里云安全最佳实践，部署在服务端使用RAM子账号或STS，部署在客户端使用STS。
  accessKeyId: 'LTAIiSA7Yhhu4fCZ',
  accessKeySecret: 'YTmzNXyhnPZKdGl1ZBcXcAKuGs4IUW',
  bucket: 'stephen-s-bookstore'
});

async function put() {
  try {
    // object表示上传到OSS的Object名称，localfile表示本地文件或者文件路径
    let r1 = await client.put('test/test.mobi','./books/test.mobi');
    console.log('put success: %j', r1);
    // let r2 = await client.get('object');
    // console.log('get success: %j', r2);
  } catch(e) {
    // console.error('error: %j', e);
    console.log(e);
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

get();
