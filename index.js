var Hapi = require('hapi');
var _ = require('lodash');
var MongoClient = require('mongodb').MongoClient;

var server = new Hapi.Server();
var confCollection;


// Connect to the db
MongoClient.connect("mongodb://127.0.0.1:27017/soga", function(err, db) {
  if(!err) {
    console.log("Connected to MongoDB");
    db.dropDatabase();
    confCollection = db.collection('configurations', function(err, collection) {
      if(err) {
        console.error('couldnt get collection');
      } else {
        console.log('got collection configuration');
      }
    });
  } else {
    console.log('failed connection to MongoDB');
    console.log(err);
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
    confCollection.find().toArray(function(err, items) {
      if(err){
        console.log('bad stuff happend');
        return;
      } else {
        reply(_.map(items, 'name'));
      }
    });
  }
});

server.route({
  method: 'GET',
  path: '/configs/{name}',
  handler: function (request, reply) {
    confCollection.findOne({'name':request.params.name}, function(err, item) {
      if(!err) {
        reply(item);
      } else {
        reply();
      }
    });
  }
});

server.route({
  method: 'DELETE',
  path: '/configs/{name}',
  handler: function (request, reply) {
    confCollection.remove({'name':request.params.name});
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
    confCollection.insert(request.payload);
    reply();
  }
});


server.start(function () {
  console.log('Server running at:', server.info.uri);
});
