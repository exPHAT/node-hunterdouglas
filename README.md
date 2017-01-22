# node-hunterdouglas

Interface with Hunter Douglas blinds using Javascript.

## Goals of this project

- Reverse engineer Hunter Douglas blind communication
- Create straightforward API for controlling blinds
- Allow easy integration with things like [homebridge](https://github.com/nfarina/homebridge) (see [homebridge-hunterdouglas](https://github.com/ExPHAT/homebridge-hunterdouglas))
- Handle errors caused by the base station
- Learn a lot and have fun

## Example

```js
var hd = require("node-hunterdouglas");

var blindController = hd({
  ip: "192.168.0.xx",
  port: 522
});

blindController.setup().then(function (rooms) {

  // You should verify that "kitchen" was successfully found, but for a simple example:
  blindController.move("kitchen", 0.5).then(function (data) {
    blindController.disconnect();
  });
});
```

## License

MIT

---

- [exphat.com](http://exphat.com)
- GitHub [@exphat](https://github.com/exphat)
- Twitter [@exphat](https://twitter.com/exphat)
