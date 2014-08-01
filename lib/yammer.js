/*
 * Buddycloud Yammer Connector - Yammer
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
var querystring = require('querystring');
var https = require('https');

var Yammer = function(config) {
    this.config = config;
};

Yammer.prototype.postMessage = function(postData) {
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
    var request = https.request(options, function(res) {
        res.setEncoding('utf8');
        var data = '';
        res.on('data', function (chunk) {
            data += chunk;
        }).on('end', function() {
            var resJson = JSON.parse(data);
          
            deferred.resolve(resJson.messages[0]);
        });
    });

    // post the data
    request.write(querystring.stringify(postData));
    request.end();
    
    return deferred.promise;
};

module.exports = Yammer;