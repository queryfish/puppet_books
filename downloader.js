const { DownloaderHelper } = require('node-downloader-helper');
const target = "http://14804066.ch3.data.tv002.com/down/e96f67e718da1dad330291c46f3daabd/%E5%9C%A3%E7%BB%8F%E4%B8%8E%E5%88%A9%E5%89%91.mobi?cts=f-D210A12A5A226Fa0444&ctp=210A12A5A226&ctt=1559766584&limit=1&spd=90000&ctk=e96f67e718da1dad330291c46f3daabd&chk=d4633e0b7beb7bbce04d9a67d9282d5b-1757257&mtd=1";
const dl = new DownloaderHelper(target, './');
dl.on('end', () => console.log('Download Completed'));
dl.start();
