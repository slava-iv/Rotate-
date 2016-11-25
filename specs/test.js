var fileHandler = require('../file-handler.js')
var neuralNetwork = require('../neural-network.js')
var dataSender = require('../data-sender.js')

var url = "./test.jpeg";
console.log("Get image: " + url);

// Send screenshot to opencv.
var data = fileHandler.handle("./test.jpeg");
console.log("recognized to: " + JSON.stringify(data));

// Send opencv data to neural network.
var result = neuralNetwork.send(data);
console.log("neural network returns: " + JSON.stringify(result));
