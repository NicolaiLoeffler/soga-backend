var Hapi = require('hapi');
var MongoClient = require('mongodb').MongoClient;

var server = new Hapi.Server();
var collection;


// Connect to the db
MongoClient.connect("mongodb://localhost:27017/exampleDb", function(err, db) {
    if(!err) {
        console.log("Connected to MondoDB");
        db.dropDatabase();
        collection = db.collection('test', function(err, collection) {});
    }
});

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
        collection.find().toArray(function(err, items) {
            if(err){
                console.log('bad stuff happend');
            } else {
                reply(items);
            }
        });
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
    method: 'DELETE',
    path: '/configs/{name}',
    handler: function (request, reply) {
      console.info(request.params.name);
      collection.remove({'name':request.params.name});
      reply();
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
        collection.insert(request.payload);
        reply();
    }
});


server.start(function () {
    console.log('Server running at:', server.info.uri);
});
