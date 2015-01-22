/*
* Buddycloud Connector - Twitter Plugin
* Copies your posts from Twitter
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
var promisify = require('promisify-me');
var PromisifyMe = require('promisify-me');
var Twit = PromisifyMe(require('twit'), 'twit');

var Twitter = function (config) {
  this.config = config;

  this.log = config.logger;
};

Twitter.prototype.init = function() {
  this.twit = new Twit(this.config.auth);
  this.stream = this.twit.stream(this.config.stream.endpoint, this.config.stream.params || {});
}

Twitter.prototype.start = function() {
  var self = this;

  this.stream.on('tweet', function(tweet) {
    var res = {
      id: tweet.id,
      channel: tweet.user.screen_name,
      sender: tweet.user.screen_name,
      payload: {
        atom: {
          content: "Tweet from @" + tweet.user.screen_name + ":\r\n" + tweet.text
        }
      }
    };

    if(tweet.retweeted_status && tweet.retweeted_status.id) {
      res.replyId = tweet.retweeted_status.id;
    }

    self.emit('messageReceived', res);
  })
}

Spritzr.spritz(Twitter, events.EventEmitter);

module.exports = Twitter;
