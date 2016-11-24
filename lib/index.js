"use strict";

var net = require("net");
var Bluebird = require("bluebird");

function pad(number, digits) {
  return Array(Math.max(digits - String(number).length + 1, 0)).join(0) + number;
}

module.exports = function BlindInitializer(config) {
  var ip = config.ip,
      port = config.port;

  if (ip === undefined || port === undefined) {
    throw new Error("ip or port can't be undefined!");
  }

  var rooms = void 0;

  var socket = void 0;
  var connected = false;

  function getConnected() {
    return connected;
  }

  // Connects/ensures connection to server
  function connect() {
    return new Bluebird(function (resolve, reject) {
      if (!socket) {
        socket = new net.Socket();
      }

      if (!connected) {
        console.log("Not connected to server, connecting now...");
        socket.connect(port, ip, function (thing) {
          connected = true; // Manually track connected status
          console.log("Connected!");
        });

        socket.on("data", function (data) {
          data = data.toString().slice(2); // Convert from buffer
          if (data.slice(0, 30) === "HunterDouglas Shade Controller") {} else {
            console.log('data', data);
            reject("Incorrect device or unsupported firmware.");
          }

          // Pretty hacky, removes the data event listener
          this.removeListener("data", [].concat(this._events.data)[0]);
          resolve(this);
        });

        socket.on("end", function () {
          console.log("Connection ended.");
          connected = false;
        });

        socket.on("error", function (err) {
          if (err.code !== "ECONNRESET") {
            throw err;
          }

          connected = false;
          console.log("ECONNRESET, not throwing error.");
        });
      } else {
        resolve(socket); // Already connected
      }
    });
  }

  // Disconnects from server
  function disconnect() {
    if (socket) {
      connected = false;
      socket.end();
    }
  }

  function sendData(toSend, lookingFor) {
    return new Bluebird(function (resolve, reject) {
      connect().then(function (s) {
        var response = ""; // We must compile the entire response
        s.on("data", function (data) {
          data = data.toString();
          response += data;

          if (data.indexOf(lookingFor) !== -1 || !lookingFor) {
            this.removeListener("data", [].concat(this._events.data)[0]);
            resolve(response);
          }
        });
        s.write(toSend);
      });
    });
  }

  function setup() {
    return sendData("$dat", "$upd01-").then(function (data) {
      rooms = {};
      data = data.split("\n\r");

      for (var i = 0; i < data.length; i++) {
        var line = data[i];
        if (line.length < 3) {
          continue;
        }
        line = line.slice(2);

        var lineData = line.split("-");

        switch (line.slice(0, 3)) {
          case "$cr":
            // Create room
            var currentId = lineData[0].slice(3);
            rooms[currentId] = {
              name: lineData.slice(-1)[0],
              blinds: []
            };
            break;
          case "$cs":
            // Create blind
            var roomId = lineData[1];
            var blindId = lineData[2];
            var someId = lineData[0].slice(3);

            var position = parseInt(data[i + 1].split("-").slice(-2)[0]) / 255;

            rooms[roomId].blinds.push({
              id: someId + "-04",
              name: lineData.slice(-1)[0],
              position: position
            });
            break;
        }
      }

      return rooms;
    });
  }

  function executeGroup(binding, position) {
    var key, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, blind;

    return regeneratorRuntime.async(function executeGroup$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            if (rooms) {
              _context.next = 2;
              break;
            }

            return _context.abrupt("return");

          case 2:
            _context.t0 = regeneratorRuntime.keys(rooms);

          case 3:
            if ((_context.t1 = _context.t0()).done) {
              _context.next = 34;
              break;
            }

            key = _context.t1.value;

            if (!(rooms[key].name.toLowerCase() === binding.toLowerCase())) {
              _context.next = 32;
              break;
            }

            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context.prev = 9;
            _iterator = rooms[key].blinds[Symbol.iterator]();

          case 11:
            if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
              _context.next = 18;
              break;
            }

            blind = _step.value;
            _context.next = 15;
            return regeneratorRuntime.awrap(sendData("$pss" + blind.id + "-" + pad(position, 3), "done"));

          case 15:
            _iteratorNormalCompletion = true;
            _context.next = 11;
            break;

          case 18:
            _context.next = 24;
            break;

          case 20:
            _context.prev = 20;
            _context.t2 = _context["catch"](9);
            _didIteratorError = true;
            _iteratorError = _context.t2;

          case 24:
            _context.prev = 24;
            _context.prev = 25;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 27:
            _context.prev = 27;

            if (!_didIteratorError) {
              _context.next = 30;
              break;
            }

            throw _iteratorError;

          case 30:
            return _context.finish(27);

          case 31:
            return _context.finish(24);

          case 32:
            _context.next = 3;
            break;

          case 34:
            return _context.abrupt("return", sendData("$rls", "act"));

          case 35:
          case "end":
            return _context.stop();
        }
      }
    }, null, this, [[9, 20, 24, 32], [25,, 27, 31]]);
  }

  function open(binding) {
    return executeGroup(binding, 255);
  }

  function close(binding) {
    return executeGroup(binding, 0);
  }

  function move(binding, percent) {
    return executeGroup(binding, Math.round(percent * 255));
  }

  return {
    sendData: sendData,
    disconnect: disconnect,
    getConnected: getConnected,
    setup: setup,
    executeGroup: executeGroup,
    open: open,
    close: close,
    move: move,
    connect: connect
  };
};
