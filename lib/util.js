/*
 * Buddycloud Connector - Util
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

var Q = require('q');

var Util = {
    autoConnectBuddycloud : function(socket) {
        var deferred = Q.defer();

        socket.on('xmpp.connection', function(data) {
            if (data.status === "online") {
                console.log("Connected to BC XMPP server. Sending Presence.");
                socket.send('xmpp.presence', {
                    priority: -1
                });

                console.log("Discovering our BC server.");
                socket.send('xmpp.buddycloud.discover')
                .then(function() {
                    console.log("Found BC server. Sending BC presence.");
                    socket.send('xmpp.buddycloud.presence');

                    deferred.resolve();
                });
            }
        });

        return deferred.promise;
    }
};

module.exports = Util;
