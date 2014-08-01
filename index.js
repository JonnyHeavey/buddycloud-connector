/*
 * Buddycloud Yammer Connector
 * Copies your posts between Buddycloud and Yammer
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
var Sockets = require('./lib/sockets');
var config = require('./config');
var Util = require('./lib/util');
var DAO = require('./lib/dao');
var Yammer = require('./lib/yammer');
var Q = require('q');

// +++ Incoming BC server
var bcSockets = new Sockets();
var socket = bcSockets.socket;

var xmpp = new ftw.Xmpp(bcSockets.serverSocket);
var buddycloud = new ftwbc();
xmpp.addListener(buddycloud);

if(config.logging.xmpp) {
    xmpp.setLogger(config.logging.xmpp);
}

var logger = config.logging.app;

Util.autoConnectBuddycloud(socket);

var yammer = new Yammer(config.yammer);

var itemMap = new DAO(config.database.dataDir + '/itemMap.db');

// Cache the buddycloud jid -> yammer group ids in a map
var bcToYammerGroupMap = {};

config.groups.forEach(function(group) {
    bcToYammerGroupMap[group.channelJid] = group.yammerId;
});

socket.on('xmpp.buddycloud.push.item', function(notification) {
    var nodeArr = notification.node.split('/');
    
    logger.log("Finding if we have a group definition for " + nodeArr[2]);
    var yammerGroupId = bcToYammerGroupMap[nodeArr[2]];
    
    if(!yammerGroupId) {
        logger.log("Skipping buddycloud group " + nodeArr[2]);
        return;
    }
    
    var postData = {
        'body': notification.entry.atom.content.content,
        'group_id' : yammerGroupId
    };

    var enrichPostReplyTo = function(postData) {
        var deferred = Q.defer();
    
        if(notification.entry['in-reply-to']) {
            logger.log('We have a reply: ' + notification.entry['in-reply-to'].ref);
            
            // Reconstruct the original post id
            var replyId = notification.id.substring(0, notification.id.lastIndexOf(',') + 1) +
                notification.entry['in-reply-to'].ref;
        
            itemMap.get(replyId)
            .then(function(yammerId) {
                if(yammerId) {
                    logger.log('Found a mapped id: ' + yammerId);
                    postData.replied_to_id = yammerId;
                }
                deferred.resolve(postData);
            })
            .fail(function(err) {
                logger.error(err);
            });
        } else {
            logger.info('Here');
            deferred.resolve(postData);
        }
        
        return deferred.promise;
    };
    
    enrichPostReplyTo(postData)
    .then(yammer.postMessage.bind(yammer))
    .then(function(yammerMessage) {
        logger.log("Posted buddycloud item " + notification.id + " as yammer item " + yammerMessage.id);
        itemMap.set(notification.id, yammerMessage.id);
    });
});
// ---

socket.emit('xmpp.login', config.buddycloud.auth);
