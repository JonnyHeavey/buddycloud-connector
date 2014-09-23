var rootLogger = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    log: function() {}
};

var config = {
    plugins: {
        yammer: {
            clazz: require('./plugins/Yammer'),
            config: {
                authtoken: 'Your Yammer OAuth2 Token',
                logger: rootLogger
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
                    app: rootLogger,
                    xmpp: rootLogger
                }
            }
        }
    },
    database: {
        dataDir: '.'
    },
    logger: rootLogger
};

module.exports = config;