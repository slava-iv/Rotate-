// Send data from neural network to arduino.

var send = function (data) {
  console.log("send to arduino: " + JSON.stringify(data));
};

module.exports = {
  send: send
};
