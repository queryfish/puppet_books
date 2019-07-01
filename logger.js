const log4js = require('log4js');

log4js.configure({
  appenders: {
                downloadInfo:
                {
                  type: 'dateFile',
                  filename: __dirname+'/logs/download_info',
                  pattern: 'yyyyMMddhh.log',
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
                  pattern: 'yyyyMMddhh.log',
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
                ,downloadInfoLogger:
                {
                  appenders: ['downloadInfo'],
                  level: 'info'
                }
                ,downloadTraceLogger:
                {
                  appenders: ['hourlyTrace','dailyTrace','consoleApnd'],
                  level: 'trace'
                }
                ,doubanTraceLogger:
                {
                  appenders: ['doubanDetailTrace','consoleApnd'],
                  level: 'trace'
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

exports.download_logger =
log4js.getLogger('downloadTraceLogger');

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
