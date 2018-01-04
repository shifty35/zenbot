'use strict';

var spawn = require('child_process').spawn;
var os = require('os');

var strategy = "srsi_macd";

function runSim(constParams, newParams, cb) {
    var params = constParams.slice(0);

    for (var index in newParams) {
        var param = newParams[index];
        params.push("--" + param.name + " " + param.value + param.suffix);
    }

    var child = spawn('./zenbot.sh', params);

    child.stdout.on('data', function (data) {
        var lines = data.toString('ascii').split(os.EOL);
        for (var index in lines) {
            if (lines[index].startsWith('vs. buy hold:')) {
                var percent = parseFloat(lines[index].split(':')[1].trim());
                console.log("Running simulation: ", params.join(' '), percent);
                cb(percent)
            }
        } 
    });

    child.stderr.on('data', function (data) {
    });

    child.on('close', function (code) {
    });
}

var constParams = ['sim', '--order_type taker', '--days 1', '--strategy ' + strategy];

var stopParams = [
    {
        name: "sell_stop_pct",
        value: 30,
        min_value: .01,
        max_value: 100,
        suffix: ""
    },
    {
        name: "buy_stop_pct",
        value: 30,
        min_value: .01,
        max_value: 100,
        suffix: ""
    },
    {
        name: "profit_stop_enable_pct",
        value: 30,
        min_value: .01,
        max_value: 100,
        suffix: ""
    },
    {
        name: "profit_stop_pct",
        value: 30,
        min_value: .01,
        max_value: 100,
        suffix: ""
    },
];

var mutableParams = {}

mutableParams.trend_ema = [
    {
        name: "period",
        value: 600,
        min_value: 10,
        max_value: 600,
        suffix: "s",
        type: "integer"
    },
    {
        name: "trend_ema",
        value: 10,
        min_value: 1,
        max_value: 200,
        suffix: "",
        type: "integer"
    }
];


mutableParams.srsi_macd = [
    {
        name: "period",
        value: 600,
        min_value: 10,
        max_value: 600,
        suffix: "s",
        type: "integer"
    },
    {
        name: "min_periods",
        value: 100,
        min_value: 1,
        max_value: 200,
        suffix: "",
        type: "integer"
    },
    {
        name: "rsi_periods",
        value: 14,
        min_value: 1,
        max_value: 200,
        suffix: "",
        type: "integer"
    },
    {
        name: "rsri_periods",
        value: 9,
        min_value: 1,
        max_value: 100,
        suffix: "",
        type: "integer"
    },
    {
        name: "srsi_k",
        value: 5,
        min_value: 1,
        max_value: 20,
        suffix: "",
        type: "integer"
    },
    {
        name: "srsi_d",
        value: 3,
        min_value: 1,
        max_value: 20,
        suffix: "",
        type: "integer"
    },
    {
        name: "oversold_rsi",
        value: 1,
        min_value: 1,
        max_value: 1,
        suffix: "",
        type: "integer"
    },
    {
        name: "overbought_rsi",
        value: 99,
        min_value: 99,
        max_value: 99,
        suffix: "",
        type: "integer"
    },
    {
        name: "ema_short_period",
        value: 24,
        min_value: 1,
        max_value: 200,
        suffix: "",
        type: "integer"
    },
    {
        name: "ema_long_period",
        value: 200,
        min_value: 1,
        max_value: 1000,
        suffix: "",
        type: "integer"
    },
    {
        name: "signal_period",
        value: 9,
        min_value: 1,
        max_value: 99,
        suffix: "",
        type: "integer"
    }
];

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function mutate(params, generation) {
    var outputParams = [];

    for (var index in params) {
        var param = params[index];
        var spread = Math.round(((param.max_value - param.min_value) / 2) / generation);

        param.value += getRandomInt(-spread, spread);
        param.value = Math.max(param.value, param.min_value);
        param.value = Math.min(param.value, param.max_value);
        outputParams.push(param);
    }

    return outputParams;

}

var generations = 15;
var bestResult = 0;
var bestParams = mutableParams[strategy];;

var maxSimultaneousSims = 4;
var simulationsPerGeneration = 128;
var running = 0;

function doGeneration(generationNum) {
    if (generationNum > generations) {
        console.log("Process Complete.");
        console.log("Best Result:", bestResult);

        var params = [];
        for (var index in bestParams) {
            var param = bestParams[index];
            params.push("--" + param.name + " " + param.value + param.suffix);
        }

        console.log(params.join(' '));
        return;
    }

    console.log("Generation:", generationNum);

    function finalize() {
        doGeneration(generationNum+1);
    }


    var complete = 0;

    function completeSim(result) {
        if (result > bestResult) {
            bestResult = result;
            bestParams = newParams;
            console.log("New Best:", result);
        }
        if (complete == simulationsPerGeneration) {
            finalize();
        } else {
            doSim();
        }
    }

    function doSim() {
        running++;
        var newParams = mutate(bestParams, generationNum);
        runSim(constParams, newParams, function (result) {
            running--;
            complete++;
            if (result > bestResult) {
                bestResult = result;
                bestParams = newParams;
                console.log("New Best:", result);
            }
            if (complete == simulationsPerGeneration) {
                finalize();
            } else if (complete < simulationsPerGeneration && running < maxSimultaneousSims) {
                doSim();
            } else {
                return;
            }
        });
    }



    for (var k = 0; k < maxSimultaneousSims; k++) {
        doSim();
    }

    
}

doGeneration(1);

process.on('SIGINT', function () {
        console.log("Process Complete.");
        console.log("Best Result:", bestResult);

        var params = [];
        for (var index in bestParams) {
            var param = bestParams[index];
            params.push("--" + param.name + " " + param.value + param.suffix);
        }

        console.log(params.join(' '));
});


