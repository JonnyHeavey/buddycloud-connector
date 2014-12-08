// Use winston as the default logger
var winston = require('winston');

var config = {
  plugins: {
    yammer: {
      clazz: require('./plugins/Yammer'),
      config: {
        authtoken: 'Your Yammer OAuth2 Token',
        logger: winston
      },
      channelMapper: {
        mapOutgoing: function (channel) {
          // Used to map a buddycloud channel to a Yammer group
          switch (channel) {
            case 'some-group@yourbuddycloudserver.com':
              return 12345; // The Yammer group ID to map the channel to
            }

            return 54321; // The default Yammer group to use
          },
          mapIncoming: function (channel) {
            // Used to map a Yammer group to a buddycloud channel
            switch (channel) {
              case 12345:
                return 'some-group@yourbuddycloudserver.com';
              }

              return 'lounge@yourbuddycloudserver.com'; // Default channel
            }
          }
        },
        buddycloud: {
          clazz: require('./plugins/Buddycloud'),
          config: {
            auth: {
              jid: 'your jid',
              password: 'your password'
            },
            logging: {
              app: winston,
              xmpp: new (winston.Logger)({
                transports: [
                new (winston.transports.File)({ filename: 'buddycloud_xmpp.log' })
                ]
              })
            }
          }
        }
      },
      database: {
        dataDir: '.'
      },
      logger: winston
    };

    module.exports = config;
