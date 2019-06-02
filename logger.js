const log4js = require('log4js');
log4js.configure({
  appenders: { cheese: { type: 'file', filename: 'cheese.log' }
              ,console: { type: 'console' }
            },
  categories: { default: { appenders: ['cheese'], level: 'trace' }
                ,another: { appenders: ['console'], level: 'trace' }
              }
});
const talker = log4js.getLogger('another');
const noter = log4js.getLogger('cheese');

function log(message) {
  // talker.trace(message);
  // noter.trace(message);
  console.log(message);
}
//example
// logger.trace('Entering cheese testing');
// console.log('Got cheese.');
// console.log('Cheese is Comté.');
// logger.warn('Cheese is quite smelly.');
// logger.error('Cheese is too ripe!');
// logger.fatal('Cheese was breeding ground for listeria.');

module.exports = {
  Logger: noter,
  info:log
};
