const log4js = require('log4js');
log4js.configure({
  appenders: { cheese: { type: 'file', filename: 'cheese.log' }
              ,console: { type: 'console' }
            },
  categories: { default: { appenders: ['cheese'], level: 'trace' }
                ,another: { appenders: ['console'], level: 'trace' }
              }
});
const logger = log4js.getLogger('cheese');

//example
// logger.trace('Entering cheese testing');
// logger.info('Got cheese.');
// Logger.info('Cheese is Comté.');
// logger.warn('Cheese is quite smelly.');
// logger.error('Cheese is too ripe!');
// logger.fatal('Cheese was breeding ground for listeria.');

module.exports = {
  Logger: logger
};
