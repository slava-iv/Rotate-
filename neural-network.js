// Send data from opencv to neural network.
var requiredPlatesNumber = 2;
var paramsNumber = 2;
var inputsNumber = paramsNumber + (2 * requiredPlatesNumber * 2)
var lastState;
function getInput(state) {
    // state = {
    //     plates: [
    //         {
    //             x: 10,
    //             y: 50,
    //         },
    //         {}
    //     ],
    //
    //     degree: 30 | 0 | 60,
    //     direct: 1 | 0
    // }
    var input = [];
    state.plates = state.plates.sort(function(a, b) {
        return a.y - b.y;
    });

    for (var i = 0 ; i < state.plates.length && state.plates[i].y < 0 ; i++ ) {}

    for (var j = 0 ; j < requiredPlatesNumber; j++ ) {
        if (state.plates[i + j] != null) {
            input[j * 4] = state.plates[i + j].x;
            input[j * 4 + 1] = state.plates[i + j].y;
        } else {
            input[j * 4] = 999;
            input[j * 4 + 1] = 999;
        }

        if (state.plates[i - j - 1] != null) {
            input[j * 4 + 2] = state.plates[i - j - 1].x;
            input[j * 4 + 3] = state.plates[i - j - 1].y;
        } else {
            input[j * 4 + 2] = -999;
            input[j * 4 + 3] = -999;
        }

    }

    input[inputsNumber - 2] = state.degree;
    input[inputsNumber - 1] = state.direct;

    return input;
}
function getOutput(state) {
    if (state.degree == 0) {
        return [1,0,0]
    }
    if (state.degree == 30) {
        return [0,1,0]
    }
    if (state.degree == 60) {
        return [0,0,1]
    }
}
var brain = require('brain.js');
var net = new brain.NeuralNetwork();

var send = function (data) {
  console.log("send to neural network: " + JSON.stringify(data));
    var input = getInput(s)

    if (state.score > lastState.score) {
        net.train([{input: getInput(lastState), output: getOutput(state)}]);
    }

    var output = net.run(input);
    lastState = state;

};

module.exports = {
  send: send
};
