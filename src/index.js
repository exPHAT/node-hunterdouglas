const net = require("net");
const Bluebird = require("bluebird");

function pad (number, digits) {
  return Array(Math.max(digits - String(number).length + 1, 0)).join(0) + number;
}

module.exports = function BlindInitializer (config) {
  const {ip, port} = config;
  if (ip === undefined || port === undefined) {
    throw new Error("ip or port can't be undefined!");
  }

  let rooms;

  let socket;
  let connected = false;

  function getConnected () {
    return connected;
  }

  // Connects/ensures connection to server
  function connect () {
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
          if (data.slice(0, 30) === "HunterDouglas Shade Controller") {

          } else {
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
  function disconnect () {
    if (socket) {
      connected = false;
      socket.end();
    }
  }

  function sendData (toSend, lookingFor) {
    return new Bluebird(function (resolve, reject) {
      connect().then(function (s) {
        let response = ""; // We must compile the entire response
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

  function setup () {
    return sendData("$dat", "$upd01-").then(function (data) {
      rooms = {};
      data = data.split("\n\r");

      for (let i = 0; i < data.length; i++) {
        let line = data[i];
        if (line.length < 3) {
          continue;
        }
        line = line.slice(2);

        let lineData = line.split("-");

        switch (line.slice(0, 3)) {
          case "$cr":
            // Create room
            const currentId = lineData[0].slice(3);
            rooms[currentId] = {
              name: lineData.slice(-1)[0],
              blinds: []
            };
            break;
          case "$cs":
            // Create blind
            const roomId = lineData[1];
            const blindId = lineData[2];
            const someId = lineData[0].slice(3);

            const position = parseInt(data[i + 1].split("-").slice(-2)[0])/255;

            rooms[roomId].blinds.push({
              id: `${someId}-04`,
              name: lineData.slice(-1)[0],
              position: position
            });
            break;
        }
      }

      return rooms;
    });
  }

  async function executeGroup (binding, position) {
    if (!rooms) return;

    for (let key in rooms) {
      if (rooms[key].name.toLowerCase() === binding.toLowerCase()) {
        for (let blind of rooms[key].blinds) {
          await sendData(`$pss${blind.id}-${pad(position, 3)}`, "done");
        }
      }
    }

    return sendData("$rls", "act");
  }

  function open (binding) {
    return executeGroup(binding, 255);
  }

  function close (binding) {
    return executeGroup(binding, 0);
  }

  function move (binding, percent) {
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
