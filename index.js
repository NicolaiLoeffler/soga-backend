var Hapi = require('hapi');
var _ = require('lodash');
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;

var server = new Hapi.Server();
var confCollection;
var deviceCollection;


// Connect to the db
MongoClient.connect("mongodb://127.0.0.1:27017/soga", function(err, db) {
    if (!err) {
        console.log("Connected to MongoDB");
        db.dropDatabase();
        confCollection = db.collection('configurations', function(err, collection) {
            if (err) {
                console.error(err);
            }
        });
        confCollection.createIndex({
            "name": 1
        }, {
            unique: true
        });
        deviceCollection = db.collection('devices', function(err, collection) {
            if (err) {
                console.error(err);
            } else {
                collection.insert({
                    "name": "Arduino_2",
                    "config": "Tomate",
                    "status": "connected",
                    "waterlevel": "50"
                });
            }
        });
    } else {
        console.error(err);
    }
});

server.connection({
    port: 3000,
    routes: {
        cors: {
            origin: ['http://localhost:8100']
        }
    }
});

server.route({
    method: 'GET',
    path: '/configs',
    handler: function(request, reply) {
        confCollection.find().toArray(function(err, items) {
            if (err) {
                console.error(err);
                return;
            } else {
                console.info(items);
                reply(_.map(items, 'name'));
            }
        });
    }
});

server.route({
    method: 'GET',
    path: '/configs/{name}',
    handler: function(request, reply) {
        confCollection.findOne({
            'name': request.params.name
        }, function(err, item) {
            if (!err) {
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
    handler: function(request, reply) {
        confCollection.remove({
            'name': request.params.name
        });
        reply();
    }
});

server.route({
    method: 'PUT',
    path: '/configs',
    handler: function(request, reply) {
        confCollection.updateOne({
                "_id": new ObjectID(request.payload._id)
            }, {
                $set: {
                    "waterlevel": request.payload.waterlevel
                },
                $currentDate: {
                    "lastModified": true
                }
            },
            function(err, results) {
                if (err) {
                    console.error(err);
                    reply('Failed updating').code(400);
                } else {
                    reply('Configuration updated');
                }
            });
    }
});

server.route({
    method: 'POST',
    path: '/configs',
    handler: function(request, reply) {
        confCollection.insert(
            request.payload,
            function(err, result) {
                if (err) {
                    if (err.code == 11000) {
                        reply('Configuration with this name already exists').code(409);
                    } else {
                        console.error(err);
                    }
                } else {
                    reply('Configuration created');
                }
            }
        );
    }
});

server.route({
    method: 'GET',
    path: '/devices',
    handler: function(request, reply) {
        deviceCollection.find().toArray(function(err, items) {
            if (err) {
                console.log('bad stuff happend');
                return;
            } else {
                console.info(items);
                reply(items);
            }
        });
    }
});

server.route({
    method: 'POST',
    path: '/devices',
    handler: function(request, reply) {
        console.log(request.payload);
        deviceCollection.updateOne({
                "_id": new ObjectID(request.payload._id)
            }, {
                $set: {
                    "config": request.payload.config
                },
                $currentDate: {
                    "lastModified": true
                }
            },
            function(err, results) {
                if (err) {
                    console.error(err);
                }
                reply();
            });
    }
});

server.start(function() {
    console.log('Server running at:', server.info.uri);
});
