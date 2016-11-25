// Send data from opencv to neural network.

var send = function (data) {
  console.log("send to neural network: " + JSON.stringify(data));
};

module.exports = {
  send: send
};
