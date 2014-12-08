/*
* Buddycloud Connector - Buddycloud Plugin
* Copies your posts to and from Buddycloud
*
* Copyright 2014 Surevine Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

var ftw = require('xmpp-ftw');
var ftwbc = require('xmpp-ftw-buddycloud');
var Sockets = require('../lib/Sockets');
var Util = require('../lib/Util');
var Spritzr = require('spritzr');
var events = require('events');
var Q = require('q');

var Buddycloud = function (config) {
  this.config = config;

  this.log = config.logging.app;
};

Spritzr.spritz(Buddycloud, events.EventEmitter);

Buddycloud.prototype.init = function () {
  this.log.info('Initialising Buddycloud Plugin');

  this.bcSockets = new Sockets();
  this.socket = this.bcSockets.socket;

  this.xmpp = new ftw.Xmpp(this.bcSockets.serverSocket);
  this.buddycloud = new ftwbc();

  this.xmpp.addListener(this.buddycloud);

  this.socket.on('xmpp.connection', function() {
    console.log("Connected to BC XMPP server. Sending Presence.");
    socket.send('xmpp.presence', {
      priority: -1
    });
  });

  if (this.config.logging.xmpp) {
    this.xmpp.setLogger(this.config.logging.xmpp);
  }

  // Logging in kicks the whole darn thing off
  this.socket.emit('xmpp.login', this.config.auth);

  this.postsNode = '/user/' + this.config.channel + '/posts';

  // The socket map stores the various user's buddycloud connections
  this._connectionMap = {};

  this._connectionMap[this.config.auth.jid] = {
    sockets: this.bcSockets,
    xmpp: this.xmpp,
    buddycloud: this.buddycloud
  };

  return Util.autoConnectBuddycloud(this.socket);

  this.log.info('Buddycloud Plugin initialised');
};

Buddycloud.prototype.start = function () {
  this.log.info('Starting Buddycloud Plugin');

  // Hook up the incoming message event
  this.socket.on('xmpp.buddycloud.push.item', this._itemNotification.bind(this));

  this.log.info('Buddycloud Plugin started');
};

Buddycloud.prototype.sendMessage = function (data) {
  var self = this;

  var content = data.payload;

  if (data.replyId) {
    var splitId = Buddycloud.parseFullId(data.replyId);

    if(splitId) {
      content['in-reply-to'] = {
        "ref": splitId.id
      };
    }
  }

  var node;

  if(data.channel) {
    node = '/user/' + data.channel + '/posts';
  } else {
    node = this.postsNode;
  }

  return this._getConnectionForUser(data.sender)
  .then(function(connection) {
    //        return this._createChannelIfRequired(node)
    //          .then()
    return connection.sockets.socket.send('xmpp.buddycloud.publish', {
      node: node,
      content: content
    }).fail(function (error) {
      var resolveFn;

      if ((error.type === 'auth') && (error.condition === 'forbidden')) {
        self.log.info('Forbidden from posting to ' + node + '. Attempting join channel.');

        resolveFn = function () {
          return connection.sockets.socket.send('xmpp.buddycloud.subscribe', {
            node: node
          });
        };
      } else {
        self.log.info('Node ' + node + ' may not exist. Attempting to create it');

        resolveFn = function () {
          return connection.sockets.socket.send('xmpp.buddycloud.create', {
            node: node,
            options: [
            {
              'var': 'buddycloud#default_affiliation',
              value: 'publisher'
            },
            {
              'var': 'pubsub#access_model',
              value: 'open'
            },
            {
              'var': 'pubsub#title',
              value: node
            },
            {
              'var': 'pubsub#description',
              value: 'Mirror of the ' + node + ' channel'
            },
            {
              'var': 'buddycloud#channel_type',
              value: 'topic'
            }
            ]
          });
        };
      }

      return resolveFn()
      .then(function (data) {
        return userSocket.send('xmpp.buddycloud.publish', {
          node: node,
          content: content
        });
      });
    });
  }).then(function (newPayload) {
    data.id = newPayload.id;

    return data;
  });
};

Buddycloud.prototype._itemNotification = function (notification) {
  var nodeArr = notification.node.split('/');

  var data = {
    id: notification.id,
    sender: notification.entry.atom.author.name,
    channel: nodeArr[2],
    payload: notification
  };

  if (notification.entry['in-reply-to']) {
    var mainId = Buddycloud.parseFullId(notification.id);

    data.replyId = 'tag:' + mainId.service + ',' + mainId.node + ',' + notification.entry['in-reply-to'].ref;
  }

  this.emit('messageReceived', data);
};

Buddycloud.prototype._getConnectionForUser = function(userJid) {
  this.log.debug("Getting a new connection for " + userJid);

  var connection = this._connectionMap[userJid];

  if(connection) {
    this.log.debug("Found existing connection for " + userJid);
    return Q(connection);
  }

  this.log.debug("No existing connection for " + userJid + " - starting a new one");

  connection = {};

  connection.sockets = new Sockets();
  connection.xmpp = new ftw.Xmpp(connection.sockets.serverSocket);
  connection.buddycloud = new ftwbc();

  connection.xmpp.addListener(connection.buddycloud);

  if (this.config.logging.xmpp) {
    connection.xmpp.setLogger(this.config.logging.xmpp);
  }

  // Logging in kicks the whole darn thing off
  connection.sockets.socket.emit('xmpp.login', this.config.authFactory(userJid));

  this._connectionMap[userJid] = connection;

  return Util.autoConnectBuddycloud(connection.sockets.socket)
  .then(function() {
    this.log.debug("Opened new connection for " + userJid);
    return connection;
  });
};

Buddycloud.parseNode = function(node) {
  var matches = id.match(/^\/user\/([^\/]+)\/(\w+)$/);

  if(!matches) {
    return null;
  }

  return {
    channel: matches[1],
    type: matches[2]
  };
};

Buddycloud.parseFullId = function(id) {
  var matches = id.match(/^tag:([^,]+),([^,]+),([^,]+)$/);

  if(!matches) {
    return null;
  }

  return {
    service: matches[1],
    node: matches[2],
    id: matches[3]
  };
};

module.exports = Buddycloud;
