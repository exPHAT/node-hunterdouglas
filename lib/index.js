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

  function sendData (toSend, toRecv) {
    return new Bluebird(function (resolve, reject) {
      let confirmed = false;
      let socket = new net.Socket();

      socket.connect(port, ip);

      toSend = [].concat(toSend);
      toRecv = [].concat(toRecv);

      let resp = "";

      socket.on("data", function (data) {
        data = data.toString().slice(2);
        resp += data;

        if (!confirmed) {
          if (data.slice(0, 30) === "HunterDouglas Shade Controller") {
            confirmed = true; // Connection is confirmed
          } else {
            console.log('data', data);
            reject("Incorrect device or unsupported firmware.");
          }
          socket.write(toSend[0]);
          toSend = toSend.slice(1);

          return;
        }

        if (data.indexOf(toRecv[0] || "`") !== -1) {
          if (toSend.length > 0) {
            socket.write(toSend[0]);
            toSend = toSend.slice(1);
            toRecv = toRecv.slice(1);
          } else {

            socket.end();
            resolve(resp);
          }
        }
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

        lineData = line.split("-");

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

  function executeGroup (binding, position) {
    if (!rooms) return;

    let commands = [];
    let recv = [];
    Object.keys(rooms).forEach(function (key) {
      if (rooms[key].name.toLowerCase() === binding.toLowerCase()) {
        rooms[key].blinds.forEach(function (blind) {
          commands.push(`$pss${blind.id}-${pad(0, 3)}`);
          recv.push("done");
        });
      }
    });
    commands.push(`$rls`);
    recv.push("act");

    return sendData(commands, recv);
  }

  function open (binding) {
    return executeGroup(binding, 1);
  }

  function close (binding) {
    return executeGroup(binding, 0);
  }

  function openPercent (binding, percent) {
    return executeGroup(binding, percent);
  }

  return {
    sendData: sendData,
    setup: setup,
    executeGroup: executeGroup,
    open: open,
    close: close,
    openPercent: openPercent
  };
};
