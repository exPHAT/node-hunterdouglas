const hd = require(".");

const blindController = hd({
  ip: "192.168.1.41",
  port: 522
});

blindController.setup().then(function (rooms) {
  console.log('rooms', rooms);

  blindController.close("family room").then(function (data) {
    console.log('data', data);
  }).catch(function (err) {
    console.log('err', err);
  }).then(function () {
    blindController.disconnect();
  });
});
