const log4js = require('log4js');
log4js.configure({
  appenders: { cheese: { type: 'file', filename: 'cheese.log' }
              ,console: { type: 'console' }
            },
  categories: { default: { appenders: ['cheese'], level: 'trace' }
                ,console: { appenders: ['console'], level: 'trace' }
              }
});

const talker = log4js.getLogger('console');
// const noter = log4js.getLogger('cheese');
exports.info =
function(message) {
  talker.trace(message);
  // noter.trace(message);
  // Logger.info(message);
}

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
