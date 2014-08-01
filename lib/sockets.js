/*
 * Buddycloud Yammer Connector - Sockets
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

var Event = require('events').EventEmitter;
var Q = require('q');

var Sockets = function() {
	var socket = new Event();
	var serverSocket = new Event();
	
	socket.send = socket.emit = function() {
		return Object.getPrototypeOf(serverSocket).emit.apply(serverSocket,
				arguments);
	};
	
	socket.send = function(event, data, callback) {
		if (typeof (data) === 'undefined') {
			data = {};
		}
	
		if (typeof (callback) !== "undefined") {
			return socket.emit(event, data, callback);
		}
	
		var deferred = Q.defer();
	
		socket.emit(event, data, function(error, data) {
			if(error) {
				deferred.reject(error);				
			} else {
				deferred.resolve(data);
			}
		});
	
		return deferred.promise;
	};
	
	serverSocket.send = serverSocket.emit = function() {
		return Object.getPrototypeOf(socket).emit.apply(socket, arguments);
	};
	
	this.serverSocket = serverSocket;
	this.socket = socket;
};

module.exports = Sockets;