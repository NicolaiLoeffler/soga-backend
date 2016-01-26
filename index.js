var _ = require('lodash');
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;

var confCollection;
var deviceCollection;
var msgCollection;
var wlCollection;

var Hapi = require('hapi');
var server = new Hapi.Server();
server.connection({
    port: 3000,
    routes: {
        cors: {
            origin: ['http://localhost:8100']
        }
    }
});

var io = require('socket.io')(server.listener);

var lowWaterSent = false;
var systemMessage = {
    user: '',
    system: true,
    content: ''
};

var waterLevel = {
    value: 10
};

var dayInMs = 3000;//86400000 ;
var galileoIp;

setInterval(persistsWaterLevel,dayInMs);

function persistsWaterLevel() {
  wlCollection.insertOne(_.cloneDeep(waterLevel))
      .then(result => {
          console.log('waterlevel stored' + waterLevel.value);
      })
      .catch(err => {
          console.error(err);
      });
}

io.on('connection', function(socket) {
    console.log('New connection from ' + socket.request.connection.remoteAddress);

    socket.on('device:online', function(data) {
        if(data.name === 'Galileo') {
            console.log('Galileo:online');
            galileoIp = socket.request.connection.remoteAddress;
            socket.broadcast.emit('device:online', data);
        }
    });

    socket.on("sensor:moisture", function(data) {
        socket.broadcast.emit('backend:moisture', data);
    });

    socket.on('sensor:waterlevel', function(data) {
        waterLevel.value = data.value;
        socket.broadcast.emit('backend:waterlevel', data);
        var criticalLevel = 40;
        if(data.value < criticalLevel && !lowWaterSent) {
            systemMessage.content = 'Critical water-level below '+criticalLevel;
            storeMessage(systemMessage);
            socket.broadcast.emit('chat:message', systemMessage);
            lowWaterSent = true;
        }
        if(data.value > 40 && lowWaterSent) {
            systemMessage.content = 'Water tank was filled!';
            storeMessage(systemMessage);
            socket.broadcast.emit('chat:message', systemMessage);
            lowWaterSent = false;
        }
    });

    socket.on('disconnect', function() {
        console.log('Client disconnected '+ socket.request.connection.remoteAddress);
        if(socket.request.connection.remoteAddress === galileoIp) {
          console.log('Galileo:offline');
          socket.broadcast.emit('device:offline', {name: 'Galileo'});
        }
    });

    /* ******* Chat ********* */
    socket.on('chat:newMessage', function(message) {
        console.log('received chat message (' + message.content + ') from ' + message.user);
        socket.broadcast.emit('chat:message', message);
        storeMessage(message);
    });

});

function storeMessage(message) {
      msgCollection.insertOne(message)
          .then(result => {
              console.log('message stored');
          })
          .catch(err => {
              console.error(err);
          });
}



server.start(function() {
    console.log('Server running at:', server.info.uri);
});


// Connect to the db
MongoClient.connect("mongodb://127.0.0.1:27017/soga")
    .then(db => {
        console.log("Connected to MongoDB");
        deviceCollection = db.collection('devices');
        confCollection = db.collection('configurations');
        msgCollection = db.collection('messages');
        wlCollection = db.collection('waterlevels');
        db.collection('waterlevels').remove();
        confCollection.createIndex({
            "name": 1
        }, {
            unique: true
        });
    })
    .catch(err => {
        console.error(err);
    });


server.route({
    method: 'GET',
    path: '/configs',
    handler: function(request, reply) {
        confCollection.find().toArray()
            .then(items => {
                reply(_.map(items, 'name'));
            })
            .catch(err => {
                console.error(err);
                reply().code(500);
            });
    }
})

server.route({
    method: 'GET',
    path: '/configs/{name}',
    handler: function(request, reply) {
        confCollection.findOne({
                'name': request.params.name
            })
            .then(item => {
                reply(item);
            })
            .catch(err => {
                reply().code(404);
            });
    }
});

server.route({
    method: 'DELETE',
    path: '/configs/{name}',
    handler: function(request, reply) {
        confCollection.remove({
                'name': request.params.name
            })
            .then(() => {
                reply();
            })
            .catch(err => {
                reply().code(404);
            });
    }
});

server.route({
    method: 'PUT',
    path: '/configs/{name}',
    handler: function(request, reply) {
        confCollection.updateOne({
                "_id": new ObjectID(request.payload._id)
            }, {
                $set: {
                    "moisture": request.payload.moisture
                },
                $currentDate: {
                    "lastModified": true
                }
            })
            .then(() => {
                reply('Configuration updated');
            })
            .catch(err => {
                console.error(err);
                reply('Failed updating').code(400);
            });
    }
});

server.route({
    method: 'POST',
    path: '/configs',
    handler: function(request, reply) {
        confCollection.insert(request.payload)
            .then(result => {
                reply('Configuration created').code(201);
            })
            .catch(err => {
                if (err.code == 11000) {
                    reply('Configuration with this name already exists').code(409);
                } else {
                    console.error(err);
                    reply().code(500);
                }
            });
    }
});


server.route({
    method: 'GET',
    path: '/devices',
    handler: function(request, reply) {
        deviceCollection.find().toArray()
            .then(items => {
                reply(items);
            })
            .catch(err => {
                reply().code(500);
            });
    }
});

server.route({
    method: 'POST',
    path: '/devices',
    handler: function(request, reply) {

        deviceCollection.updateOne({
                "_id": new ObjectID(request.payload._id)
            }, {
                $set: {
                    "config": request.payload.config
                },
                $currentDate: {
                    "lastModified": true
                }
            })
            .then(() => {
                reply();
            })
            .catch(err => {
                console.error(err);
                reply().code(500);
            });

        confCollection.findOne({
                'name': request.payload.config
            })
            .then(config => {
                console.log(config);
                console.log('emmiting ' + config.moisture);
                io.emit('backend:configuration', {
                    moisture: config.moisture
                });
            })
            .catch(err => {
                console.error(err);
            })

    }
});

server.route({
    method: 'GET',
    path: '/messages',
    handler: function(request, reply) {
        msgCollection.find().sort({_id:1}).limit(50).toArray()
            .then(result => {
                reply(result);
            })
            .catch(err => {
                console.log(err);
                reply().code(500);
            });
    }
});

server.route({
    method: 'GET',
    path: '/waterlevels',
    handler: function(request, reply) {
        wlCollection.find().sort({_id:-1}).limit(7).toArray()
            .then(result => {
                reply(result);
            })
            .catch(err => {
                console.log(err);
                reply().code(500);
            });
    }
});
