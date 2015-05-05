var Hapi = require('hapi');

var server = new Hapi.Server();

fs = require('fs');


var configs = require('./configs.json');


/*fs.writeFile('configs.json', JSON.stringify(test), function (err) {
  if (err) return console.log(err);
  console.log('Hello World > helloworld.txt');
});*/

server.connection({
    port: 3000,
    routes: {
        cors : {
            origin: ['http://localhost:8100']
        }
    }
});

server.route({
    method: 'GET',
    path: '/configs',
    handler: function (request, reply) {
        reply(Object.keys(configs));
    }
});

server.route({
    method: 'GET',
    path: '/configs/{name}',
    handler: function (request, reply) {
        var config = {
            "id" : "1234",
            "moisture": "30",
        }
        reply(config);
    }
});

server.route({
    method: 'GET',
    path: '/devices',
    handler: function (request, reply) {
        var devices = [
            {
                "name": "Arduino_1",
                "config": "Kaktus",
                "status": "not connected"
            },
            {
                "name": "Arduino_2",
                "config": "Tomate",
                "status": "connected"
            }
        ];
        reply(JSON.stringify(devices));
    }
});

server.route({
    method: 'POST',
    path: '/newConfig',
    handler: function  (request, reply) {
        var configName = Object.keys(request.payload)[0];
        if(Object.keys(configs).indexOf(Object.keys(request.payload)[0]) > -1) {
            console.log("Already config with this name");
        } else {
            console.log(request.payload);
        }
        reply();
    }
});


server.start(function () {
    console.log('Server running at:', server.info.uri);
});
