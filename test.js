const hd = require(".");

const blindController = hd({
  ip: "192.168.1.15",
  port: 522
});

blindController.setup().then(function (commands) {
  blindController.open("family room").then(function (data) {
    console.log('data', data);
  }).catch(function (err) {
    console.log('err', err);
  });
});
