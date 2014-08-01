module.exports = {
    buddycloud : {
        auth: {
            jid : 'romeo@montague.net',
            password : 'juliet'
        }
    },
    yammer : {
        authtoken : 'your yammer oauth2 token',
    },
    groups: [
        {
            channelJid: 'my-channel@montague.net',
            yammerId: 123456
        }
    ],
    database: {
        dataDir: './'
    },
    logging : {
        app : console,
        xmpp : {
            log : function() { },
            info : function() { },
            warn : console.warn,
            error : console.error
        }
    }
};