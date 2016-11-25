// Send data from neural network to arduino.

var portManager = require('./port-manager');
var serialPort = null;
var portOptions = {
  baudRate: 9600
};

var init = function () {
  return portManager.getFirstArduinoPort().then(function (port) {
    if (!port) {
      throw new Error("Port not found.")
    }

    return portManager.openPort(port.comName, portOptions).then(function (port) {
      serialPort = port;

      return serialPort;
    });
  });
};

// Position is value in [-30, 30]
var send = function (position) {
  if (serialPort) {
    write(position);
  } else {
    // Try to reconnect if conection is lost.
    init().then(function () {
      write(position);
    });
  }
};

var write = function (position) {
  var value = position + 30;

  console.log("send to arduino: " + value);
  serialPort.write(new Buffer([value]));
}

module.exports = {
  init: init,
  send: send
};
