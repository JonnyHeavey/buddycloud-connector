/*
 * Buddycloud Connector - Yammer Plugin
 * Copies your posts to and from Yammer
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

var Q = require('q');
var QHttp = require('q-io/http');
var querystring = require('querystring');
var https = require('https');
var Spritzr = require('spritzr');
var events = require('events');

var Yammer = function (config) {
    this.config = config;

    this.log = config.logger;
};

Yammer.prototype.init = function () {
    return this._loadGroups()
    .then(function(groups) {
        this.groups = groups;

        this.groupMap = {};

        groups.forEach(function(group) {
            this.groupMap[group.id] = group;
        }, this);
    }.bind(this))
    .then(function() {
        return this._loadUsers();
    }.bind(this))
    .then(function(users) {
        this.users = users;

        this.userMap = {};

        users.forEach(function(user) {
            this.userMap[user.id] = user;
        }, this);
    }.bind(this));
};

Yammer.prototype.start = function () {
    this._enablePolling(true);
};

Yammer.prototype.sendMessage = function (data) {
    var postData = {
        'group_id': data.channel,
        'body': data.payload.entry.atom.content.content
    };

    if (data.replyId) {
        postData.replied_to_id = data.replyId;
    }

    return this._postMessage(postData)
        .then(function (yammerMessage) {
            data.id = yammerMessage.id;

            return data;
        });
};

Yammer.prototype._loadGroups = function() {
    return QHttp.read({
        url: "https://www.yammer.com/api/v1/groups.json?mine=1",
        headers: {
            'Authorization': 'Bearer ' + this.config.authtoken
        }
    }).then(function(body) {
        return JSON.parse(body);
    });
};

Yammer.prototype._loadUsers = function() {
    return QHttp.read({
        url: "https://www.yammer.com/api/v1/users.json",
        headers: {
            'Authorization': 'Bearer ' + this.config.authtoken
        }
    }).then(function(body) {
        return JSON.parse(body);
    });
};

Yammer.prototype._postMessage = function (postData) {
    var deferred = Q.defer();

    // An object of options to indicate where to post to
    var options = {
        host: 'www.yammer.com',
        port: '443',
        path: '/api/v1/messages.json',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Bearer ' + this.config.authtoken
        }
    };

    // Set up the request
    var request = https.request(options, function (res) {
        res.setEncoding('utf8');
        var data = '';
        res.on('data', function (chunk) {
            data += chunk;
        }).on('end', function () {
            var resJson = JSON.parse(data);

            deferred.resolve(resJson.messages[0]);
        });
    });

    // post the data
    request.write(querystring.stringify(postData));
    request.end();

    return deferred.promise;
};

Yammer.prototype._getMessages = function (options) {
    var deferred = Q.defer();

    var requestOpts = {
        host: 'www.yammer.com',
        port: '443',
        path: '/api/v1/messages.json?' + querystring.stringify(options),
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + this.config.authtoken
        }
    };

    // Set up the request
    var request = https.request(requestOpts, function (res) {
        res.setEncoding('utf8');
        var data = '';
        res.on('data', function (chunk) {
            data += chunk;
        }).on('end', function () {
            var resJson = JSON.parse(data);

            deferred.resolve(resJson);
        }).on('error', function (error) {
            deferred.reject(error);
        });
    });

    request.end();

    return deferred.promise;
};

Yammer.prototype._pollingEnabled = false;

Yammer.prototype._enablePolling = function (enable) {
    enable = (typeof enable == 'undefined') || !!enable;

    if (this._pollingEnabled === enable) {
        return;
    }

    this._pollingEnabled = enable;

    if (this._pollingTimer) {
        clearInterval(this._pollingTimer);
    }

    if (this._pollingEnabled) {
        this._pollForNewMessages();
        this._pollingTimer = setInterval(this._pollForNewMessages.bind(this), 60000);
    }
};

Yammer.prototype._pollForNewMessages = function () {
    var self = this;

    this.log.info('Polling yammer for messages');

    this._getMessages({
        "threaded": "extended"
    })
        .then(function (response) {
            var messages = response.messages && response.messages.slice(0) || [];

            // Append all the replies in the "threaded_extended" section
            for(var threadId in response.threaded_extended) {
                var thread = response.threaded_extended[threadId];

                for(var i in thread) {
                    messages.push(thread[i]);
                }
            }

            messages.forEach(function (message) {
                switch (message.message_type) {
                case 'update':
                    return self._getAugmentedContent(message)
                    .then(function(content) {
                        var res = {
                            id: message.id,
                            channel: message.group_id,
                            sender: message.sender_id,
                            payload: {
                                atom: {
                                    content: content
                                }
                            }
                        };

                        if (message.replied_to_id) {
                            res.replyId = message.replied_to_id;
                        }

                        self.emit('messageReceived', res);
                    });
                }
            });
        }).done();
};

Yammer.prototype._getAugmentedContent = function(message) {
    var text = '';

    return this._getGroup(message.group_id)
    .then(function(group) {
        text += 'Group: ' + group.full_name + '\n';
    })
    .then(function() {
        return this._getUser(message.sender_id);
    }.bind(this))
    .then(function(sender) {
        text += 'Sender: ' + sender.full_name + '\n';

        text += '---\n';

        text += message.body.plain;

        return text;
    });
};

Yammer.prototype._getGroup = function(groupId) {
    var self = this;

    return Q.fcall(function() {
        if(!self.groupMap[groupId]) {
            return self._loadGroups();
        }
    })
    .then(function() {
        return self.groupMap[groupId];
    });
};


Yammer.prototype._getUser = function(userId) {
    var self = this;

    return Q.fcall(function() {
        if(!self.userMap[userId]) {
            return self._loadUsers();
        }
    })
    .then(function() {
        return self.userMap[userId];
    });
};

Spritzr.spritz(Yammer, events.EventEmitter);

module.exports = Yammer;
