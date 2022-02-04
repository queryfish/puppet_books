const OSS = require('ali-oss');

const client = new OSS({
  region: 'oss-cn-beijing',
  //云账号AccessKey有所有API访问权限，建议遵循阿里云安全最佳实践，部署在服务端使用RAM子账号或STS，部署在客户端使用STS。
    accessKeyId:'LTAI4GJFGjPc5nTz4fvKp64y',
  accessKeySecret:'uEwFR131y2MUD0qnmmsnXmIbVpzteN',
	bucket: 'stephen-s-speeches'
});

exports.putPromise = function(local, remote, options){
	return client.put(remote, local, options);
};

exports.put =
async function(localfile, remotefil) {
  try {
    // object表示上传到OSS的Object名称，localfile表示本地文件或者文件路径
    let r1 = await client.put(remotefile,localfile,{timeout:3600000});
    console.log('put success: %j', r1);
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

const cid = 'my-channel';
const conf = {
	  Description: 'this is channel 1',
	  Status: 'enabled',
	  Target: {
		      Type: 'HLS',
		      FragDuration: '10',
		      FragCount: '5',
		      PlaylistName: 'playlist.m3u8'
		    }
};
(async ()=>{

const r = await client.putChannel(cid, conf);
console.log(r);
const url = client.getRtmpUrl(cid, {
		  params: {
			      playlistName: 'playlist.m3u8'
			    },
		  expires: 3600
	});
console.log(url);
	// rtmp://ossliveshow.oss-cn-hangzhou.aliyuncs.com/live/tl-channel?OSSAccessKeyId=T0cqQWBk2ThfRS6m&Expires=1460466188&Signature=%2BnzTtpyxUWDuQn924jdS6b51vT8%3D
})();
