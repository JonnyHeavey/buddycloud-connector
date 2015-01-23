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
        },
        twitter: {
          clazz: require('./plugins/Twitter'),
          config: {
            auth: {
              consumer_key:         'enter your consumer key',
              consumer_secret:      'enter your consumer secret',
              access_token:         'enter your access token',
              access_token_secret:  'enter your access token secret'
            },
            stream: {
              endpoint: 'statuses/filter',  // You can use other endpoints like 'statuses/firehose' if you dare!
              params: {
                track: 'fubar'  // Comma separated list of search terms
              }
            }
          },
          authMapper: {
            mapIncoming: function (username) {
              // For example - this maps a twitter '@username' to 'twitter-username@yourserver.com'
              return 'twitter-' + username + '@yourserver.com';
            }
          },
          channelMapper: {
            mapIncoming: function (channel) {
              // For example - this always posts tweets into the 'twitter@yourserver.com' channel
              return 'twitter@yourserver.com';
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
