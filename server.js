#! /usr/bin/env node

// @flow
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
app.use(bodyParser.json({ limit: '50mb' }))
const findit = require('findit')
const getPort = require('get-port')
const open = require('open')

const updateNotifier = require('update-notifier')
const pkg = require('./package.json')
var redis = require("redis"),
    client = redis.createClient(6379, "172.16.3.123");

const amqp = require('amqplib/callback_api');
const rabbitMQ='amqp://tgdd:Tgdd2O15@192.168.2.112:5672/';

updateNotifier({
    pkg,
    updateCheckInterval: 1000 * 60 * 60 * 24 // one day
}).notify()

const fs = require('fs')
const argv = require('yargs')
    .usage('This is my awesome program\n\nUsage: $0 [options]')
    .help('help').alias('help', 'h')
    .options({
        source: {
            alias: 's',
            description: '<filename> A json file in native rasa-nlu format',
            requiresArg: true,
        },
        port: {
            alias: 'p',
            description: '<port> Port to listen on',
            requiresArg: true,
        },
        development: {
            alias: 'd',
        }
    })
    .default({
        source: null,
        port: null,
        development: false,
    })
    .argv

const sourceFile = {
    path: '',
    data: {},
    isLoaded: false,
}

function readData(path) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, 'utf8', (error, raw) => {
            let json = "";

            resolve(json)
        })
    })
};


if (argv.source) {
    readData(argv.source)
        .then(data => {
            sourceFile.data = data,
                sourceFile.path = argv.source
            sourceFile.isLoaded = true
            serve()
        })
        .catch(error => {
            throw error
        })
}
else {
    console.log('searching for the training examples...')
    let isSearchingOver = false
    let inReading = 0

    function checkDone() {
        if (isSearchingOver && inReading === 0) {
            if (!sourceFile.isLoaded) {
                throw new Error(`Can't find training file, please try to specify it with the --source option`)
            }
            else {
                serve()
            }
        }
    }

    const finder = findit(process.cwd())
    finder.on('directory', function (dir, stat, stop) {
        var base = path.basename(dir)
        if (base === '.git' || base === 'node_modules') stop()
    })

    finder.on('file', function (file) {
        if (file.substr(-5) === '.json' && !sourceFile.isLoaded) {

            inReading++
            readData(file)
                .then(data => {
                    if (!sourceFile.isLoaded) { // an other file could have been loaded in the meantime
                        sourceFile.data = data,
                            sourceFile.path = file
                        sourceFile.isLoaded = true
                        console.log(`found ${file}`)
                    }
                })
                .catch(() => { })
                .then(() => {
                    inReading--
                    checkDone()
                })
        }
    })

    finder.on('end', function () {
        isSearchingOver = true
        checkDone()
    })
}
var escapeRegExp = function (strToEscape) {
    // Escape special characters for use in a regular expression
    return strToEscape.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
};

var trimChar = function (origString, charToTrim) {
    charToTrim = escapeRegExp(charToTrim);
    var regEx = new RegExp("^[" + charToTrim + "]+|[" + charToTrim + "]+$", "g");
    return origString.replace(regEx, "");
};

function serve() {
    // app.use(express.static('./build'))

    app.use(express.static(path.join(__dirname, './build')));

    if (process.env.NODE_ENV !== 'production') {
        //the dev server is running on an other port
        app.use(function (req, res, next) {
            res.header('Access-Control-Allow-Origin', '*')
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
            next()
        })
    }

    if (!argv.development) {
        app.get('/', function (req, res) {
            res.sendStatus(200);

        })
    }



    app.post('/data', function (req, res) {

        var json = "";
        json += '{' +
            '"rasa_nlu_data":' + '{' +
            '"common_examples":' + '[';

        var lstkeys = [];
        //client.select(2,function(){

        client.keys("*", function (err, arrayOfKeys) {
            arrayOfKeys.forEach(function (key) {
                // console.log(key);
                lstkeys.push(key);
            });
            lstkeys.sort();

            for (var i = 0; i < lstkeys.length; i++) {

                client.get(lstkeys[i], function (err, reply) {
                    var object = JSON.parse(reply);
                    if (object.status == 3) {

                        json += '{' + '"text":' + '"' + object.text.replace(/\n/g, '') + '"' + ',' +

                            '"status":' + object.status + ',' +
                            '"intent":' + '"' + object.intent + '"' + ',' +
                            '"key":' + '"' + object.key + '"' + ',' +
                            '"entities":' + '['
                        if (object.entities.length > 0) {
                            for (var j = 0; j < object.entities.length; j++) {
                                if (j === object.entities.length - 1) {


                                    json += '{' +
                                        '"start":' + object.entities[j].start + ',' +
                                        '"end":' + object.entities[j].end + ',' +
                                        '"value":' + '"' + object.entities[j].value + '"' + ',' +
                                        '"entity":' + '"' + object.entities[j].entity + '"' + '}';

                                }
                                else {
                                    json += '{' +
                                        '"start":' + object.entities[j].start + ',' +
                                        '"end":' + object.entities[j].end + ',' +
                                        '"value":' + '"' + object.entities[j].value + '"' + ',' +
                                        '"entity":' + '"' + object.entities[j].entity + '"' + '}' + ',';
                                }

                            }

                        }
                        json += ']},';
                        //console.log(json);
                    }

                });
            }

            setTimeout(function () {

                json = trimChar(json, ",");

                //console.log(json);
                json += ']' + '}' + '}';
                //console.log(json);
                json = JSON.parse(json);

                res.json({
                    data: json,
                    path: sourceFile.path,
                });

            }, 6000);

        });

        //});
    });


    app.post('/delete', function (req, res) {
        var data = (req.body);

        client.select(0, function () {
            client.del(data.key, function (err, response) {
                if (response == 1) {
                    console.log("Deleted Successfully!")
                    res.json({ ok: true });
                } else {
                    console.log("Cannot delete")
                    res.json({ ok: false });
                }
            });
        });

    });



    app.post('/save', function (req, res) {
        const data = req.body;
        //console.log(data.rasa_nlu_data.common_examples[0]);

        //update lai status
        for (var i = 0; i < data.rasa_nlu_data.common_examples.length; i++) {
            var object = data.rasa_nlu_data.common_examples[i];
            object.status=3;
            var key = object.key;
            var json = JSON.stringify(object);

            console.log(object.text);

            client.set(key, json, function (err, reply) {
                if (err) {
                    res.json({ ok: false });
                    console.log("FAIL AT  " + key);
                }
                console.log("Updated " + key);
            });

        }

        setTimeout(function () {
            console.log("Update Completed");
            res.json({ ok: true });
        }, 7000);

        // if (!data || !data.rasa_nlu_data) {
        //   res.json({error: 'file is invalid'})
        // }
        // fs.writeFile(sourceFile.path, JSON.stringify(data, null, 2), (error) => {
        //   if (error) {
        //     return res.json({error})
        //   }
        //   readData(sourceFile.path)
        //     .then(json => sourceFile.data = json)
        //     .catch(error => console.error(error))
        //     .then(() => res.json({ok: true}))
        // })

    });


    if (argv.port) {
        listen(argv.port)
    }
    else {
        getPort().then(port => listen(port))
    }

    function listen(port) {
        app.listen(port)
        if (!argv.development) {
            const url = `http://localhost:${port}/`
            console.log(`server listening at ${url}`)
            open(url)
        }
        else {
            console.log('dev server listening at', port)
        }
    }
}
