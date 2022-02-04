const log4js = require('log4js');

log4js.configure({
  appenders: {
                downloadInfo:
                {
                  type: 'dateFile',
                  filename: __dirname+'/logs/download_info',
                  pattern: 'yyyyMMdd.log',
                  alwaysIncludePattern: true
                }
                ,hourlyTrace:
                {
                  type: 'dateFile',
                  filename: __dirname+'/logs/hourly',
                  pattern: 'yyyyMMddhh.log',
                  alwaysIncludePattern: true
                }
                ,dailyTrace:
                {
                  type: 'dateFile',
                  filename: __dirname+'/logs/daily',
                  pattern: 'yyyyMMdd.log',
                  alwaysIncludePattern: true
                }
                ,doubanDetailTrace:
                {
                  type: 'dateFile',
                  filename: __dirname+'/logs/doubanDetail',
                  pattern: 'yyyyMMdd.log',
                  alwaysIncludePattern: true
                }
                ,runtimeStats:
                {
                  type: 'dateFile',
                  filename: __dirname+'/logs/stats',
                  pattern: 'yyyyMMdd.log',
                  alwaysIncludePattern: true
                }
                ,consoleApnd:
                {
                  type: 'console'
                }
            },
  categories: {
                default:
                {
                  appenders: ['consoleApnd'],
                  level: 'trace'
                }
                ,downloader:
                {
                  appenders: ['downloadInfo','consoleApnd'],
                  level: 'trace'
                }
                ,crawler:
                {
                  appenders: ['dailyTrace','consoleApnd'],
                  level: 'trace'
                }
                ,doubanTraceLogger:
                {
                  appenders: ['doubanDetailTrace','consoleApnd'],
                  level: 'all'
                }
                ,consolo :
                {
                  appenders:['consoleApnd'],
                  level: 'trace'
                }
                ,statsLogger :
                {
                  appenders:['runtimeStats','consoleApnd'],
                  level: 'all'
                }
              }
});

exports.downloaderLogger =
log4js.getLogger('downloader');

exports.download_logger =
log4js.getLogger('crawler');

exports.stats_logger =
log4js.getLogger('statsLogger');

exports.douban_logger =
log4js.getLogger('doubanTraceLogger');
//example
// logger.trace('Entering cheese testing');
// Logger.info('Got cheese.');
// Logger.info('Cheese is Comté.');
// logger.warn('Cheese is quite smelly.');
// logger.error('Cheese is too ripe!');
// logger.fatal('Cheese was breeding ground for listeria.');

// module.exports = {
//   Logger: noter,
//   info:log
// };
