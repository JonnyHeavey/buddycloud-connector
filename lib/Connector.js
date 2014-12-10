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

var Q = require('q');
var PromisifyMe = require('promisify-me');
var DataStore = PromisifyMe(require('nedb'), 'nedb'); // Make a promissy version of NeDB

var Connector = function (config) {
    this.config = config;

    this.log = config.logger;
};

Connector.prototype.init = function () {
    var config = this.config;

    this.plugins = {};

    var work = [];

    this.log.info("Opening datastore");

    this.db = new DataStore({
        filename: config.database.dataDir + '/itemMap.db',
        autoload: true
    });

    for (var pluginName in config.plugins) {
        work.push(this._initPlugin(pluginName));

        work.push(this.db.ensureIndex({
            fieldName: 'p.' + pluginName + '.id',
            unique: true,
            sparse: true // Setting sparse allows multiple undefined keys
        }));
    }

    return Q.all(work);
};

Connector.prototype._initPlugin = function (pluginName) {
    var self = this;

    this.log.info('Found plugin definition "' + pluginName + '"');

    var pluginDef = this.config.plugins[pluginName];

    var pluginClass = pluginDef.clazz;

    var plugin = new pluginClass(pluginDef.config);

    var pluginRecord = {
      instance: plugin
    }

    if(pluginDef.authMapper) {
      this.log.debug("Found an authMapper configured for plugin " + pluginName);
      pluginRecord.authMapper = pluginDef.authMapper;
    }

    if(pluginDef.channelMapper) {
      this.log.debug("Found a channelMapper configured for plugin " + pluginName);
      pluginRecord.channelMapper = pluginDef.channelMapper;
    }

    this.plugins[pluginName] = pluginRecord;

    if(plugin.on) {
      this.log.debug(pluginName + " has events - registering 'messageReceived' event");
      plugin.on('messageReceived', function (data) {
          self._addToInQueue(function() {
              self.log.info('Ingesting next message from ' + pluginName + ' / ID: ' + data.id + ' / ReplyTo: ' + data.replyId);

              var p = self._messageReceived(pluginName, data);

              return p;
          });
      });
    }

    return plugin.init(this);
};

Connector.prototype._currentInPromise = null;

/**
 * This is used to ensure that one message is processed in its entirety before then next one
 * in started
 */
Connector.prototype._addToInQueue = function (fn) {
    var self = this;

    // Basically checks if there is a current pending promise or not
    if (this._currentInPromise && this._currentInPromise.isPending()) {
        this._currentInPromise = this._currentInPromise.then(fn);
    } else {
        this._currentInPromise = fn();
    }
};

Connector.prototype.start = function () {
    this.log.info('Starting Connector');
    var work = [];

    for (var pluginName in this.plugins) {
        work.push(this.plugins[pluginName].instance.start());
    }

    return Q.all(work);
};

Connector.prototype._findRecordFromPluginMsgId = function (pluginName, pluginMsgId) {
    if (!pluginMsgId) {
        return;
    }

    // First let's find out if we already know about this message
    var query = {};

    query['p.' + pluginName + '.id'] = pluginMsgId;

    return this.db.findOne(query).exec();
};

/**
 * Called when a message is received from one of the plugins
 */
Connector.prototype._messageReceived = function (pluginName, data) {
    this.log.info('Received message from ' + pluginName + ' plugin');

    var self = this;

    var deferred = Q.defer();

    // First let's find out if we already know about this message
    var query = {};

    query['p.' + pluginName + '.id'] = data.id;

    this.db.findOne(query).exec()
        .then(function (result) {
            if (!result) {
                self.log.info(pluginName + ' message id ' + data.id + ' not found');
                data.o = 1;

                var oData = {
                  payload: data.payload,
                  sender: data.sender,
                  channel: data.channel
                };

                var pluginRecord = self.plugins[pluginName];

                if(pluginRecord.authMapper && pluginRecord.authMapper.mapIncoming) {
                    oData.sender = pluginRecord.authMapper.mapIncoming(oData.sender);

                    if(!oData.sender) {
                        // We're going to ignore it
                        self.log.info('Incoming authMapper for ' + pluginName + ' returned falsy for sender ' + data.sender + ' - ignoring.');
                        return;
                    }
                }

                if(pluginRecord.channelMapper && pluginRecord.channelMapper.mapIncoming) {
                    oData.channel = pluginRecord.channelMapper.mapIncoming(oData.channel);

                    if(!oData.channel) {
                        // We're going to ignore it
                        self.log.info('Incoming channelMapper for ' + pluginName + ' returned falsy for channel ' + data.channel + ' - ignoring.');
                        return;
                    }
                }

                var record = {
                    p: {},
                    sender: oData.sender,
                    channel: oData.channel
                };

                record.p[pluginName] = data;

                var replyTo = null;
                var target = null;

                return Q.fcall(function () {
                        if (data.replyId) {
                            return self._findRecordFromPluginMsgId(pluginName, data.replyId);
                        }
                    })
                    .then(function (replyRecord) {
                        if (replyRecord) {
                            record.replyId = replyRecord._id;
                            replyTo = replyRecord;
                        }

                        return record;
                    })
                    .then(function() {
                      if (data.targetId) {
                        return self._findRecordFromPluginMsgId(pluginName, data.targetId);
                      }
                    })
                    .then(function (targetRecord) {
                      if (targetRecord) {
                        record.targetId = targetRecord._id;
                        target = targetRecord;
                      }

                      return record;
                    })
                    .then(function (record) {
                        return self.db.insert(record);
                    })
                    .then(function (record) {
                        return self._sendUpdates(record, oData, replyTo, target);
                    });
            } else {
                self.log.info(pluginName + ' message id ' + data.id + ' already ingested');
                // TODO: Handle updates (do we need to?)
            }
        })
        .fail(function(err) {
          console.log(err);
            self.log.error(err);
        })
        .finally(function() {
            deferred.resolve();
        });

    return deferred.promise;
};

/**
 * Called to send an update to the other plugins
 */
Connector.prototype._sendUpdates = function (record, payload, replyRecord, targetRecord) {
    var work = [];

    for (var pluginName in this.plugins) {
        work.push(this._sendUpdate(pluginName, record, payload, replyRecord, targetRecord));
    }

    return Q.all(work);
};

/**
 * Sends an update to a specific plugin
 */
Connector.prototype._sendUpdate = function (pluginName, record, data, replyRecord, targetRecord) {
    var self = this;

    // If we haven't already informed the plugin
    if (!record.p[pluginName]) {
        var pluginRecord = this.plugins[pluginName];
        var plugin = pluginRecord.instance;

        var oData = {
          payload: data.payload,
          sender: data.sender,
          channel: data.channel
        };

        if (replyRecord && replyRecord.p[pluginName]) {
          oData.replyId = replyRecord.p[pluginName].id;
        }

        if (targetRecord && targetRecord.p[pluginName]) {
          oData.targetId = targetRecord.p[pluginName].id;
        }

        if(pluginRecord.authMapper && pluginRecord.authMapper.mapOutgoing) {
            oData.sender = pluginRecord.authMapper.mapOutgoing(oData.sender);

            if(!oData.sender) {
                // We're going to ignore it
                self.log.info('Outgoing authMapper for ' + pluginName + ' returned falsy for sender ' + data.sender + ' - ignoring.');
                return;
            }
        }

        if(pluginRecord.channelMapper && pluginRecord.channelMapper.mapOutgoing) {
            oData.channel = pluginRecord.channelMapper.mapOutgoing(oData.channel);

            if(!oData.channel) {
                // We're going to ignore it
                self.log.info('Outgoing channelMapper for ' + pluginName + ' returned falsy for channel ' + data.channel + ' - ignoring.');
                return;
            }
        }

        record.p[pluginName] = {}; // Save a blank object so we know we're working on it

        var update = {
            $set: {}
        };

        update.$set['p.' + pluginName] = {};

        return this.db.update({
                _id: record._id
            }, update, {})
            .then(function () {
                return plugin.sendMessage(oData);
            })
            .then(function (result) {
                record.p[pluginName] = result;

                update.$set['p.' + pluginName] = result;

                return self.db.update({
                    _id: record._id
                }, update, {});
            })
        .fail(function(err) {
          console.log(err);
            self.log.error(err);
        });

    }
};

module.exports = Connector;
