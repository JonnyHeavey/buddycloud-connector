/*
 * Buddycloud Yammer Connector - DAO
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
var NeDB = require('nedb');

var DAO = function DAO(file) {
    this.db = new NeDB({
        filename: file,
        autoload: true
    });
};

DAO.prototype.set = function(key, value) {
    var deferred = Q.defer();
    
    this.db.update({
        _id: key
    }, {
        value: value
    }, {
        upsert: true
    }, function(err, docs) {
        if(err) {
            deferred.reject(err);
        } else {
            deferred.resolve(docs);
        }
    });
};

DAO.prototype.get = function(key) {
    var deferred = Q.defer();
    
    this.db.findOne({
        _id: key
    }, function(err, doc) {
        if(err) {
            deferred.reject(err);
        } else {
            deferred.resolve(doc.value);
        }
    });
    
    return deferred.promise;
};

module.exports = DAO;