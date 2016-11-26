var fileHandler = require('../file-handler.js')
var neuralNetwork = require('../neural-network.js')
var dataSender = require('../data-sender.js')

var url = "./files/game.jpg";
console.log("Get image: " + url);

// Send screenshot to opencv.
var data = fileHandler.handle(url);
console.log("recognized to: " + JSON.stringify(data));

// Send opencv data to neural network.
var result = neuralNetwork.send(data);
console.log("neural network returns: " + JSON.stringify(result));
