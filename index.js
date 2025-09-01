const express = require('express');
const http = require('http');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
const path = require("path");
const xss = require("xss");

const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
    cors: {
        origin: "*", // Consider specifying origin in production!
    }
});

app.use(cors());
app.use(bodyParser.json());

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, "build")));
    app.get("*", (req, res) => {
        res.sendFile(path.join(__dirname, "build", "index.html"));
    });
}

app.set('port', process.env.PORT || 4001);

const sanitizeString = (str) => xss(str);

const connections = {};
const messages = {};
const timeOnline = {};

io.on('connection', (socket) => {

    socket.on('join-call', (roomPath) => {
        if (!connections[roomPath]) {
            connections[roomPath] = [];
        }
        connections[roomPath].push(socket.id);

        timeOnline[socket.id] = new Date();

        // Notify all users in the room
        connections[roomPath].forEach(id => {
            io.to(id).emit("user-joined", socket.id, connections[roomPath]);
        });

        // Send chat history
        if (messages[roomPath]) {
            messages[roomPath].forEach(msg => {
                io.to(socket.id).emit("chat-message", msg.data, msg.sender, msg['socket-id-sender']);
            });
        }

        console.log(roomPath, connections[roomPath]);
    });

    socket.on('signal', (toId, message) => {
        io.to(toId).emit('signal', socket.id, message);
    });

    socket.on('chat-message', (data, sender) => {
        data = sanitizeString(data);
        sender = sanitizeString(sender);

        let roomKey;
        let found = false;

        Object.entries(connections).forEach(([k, v]) => {
            if (v.includes(socket.id)) {
                roomKey = k;
                found = true;
            }
        });

        if (found) {
            if (!messages[roomKey]) {
                messages[roomKey] = [];
            }
            messages[roomKey].push({
                sender,
                data,
                'socket-id-sender': socket.id
            });
            console.log("message", roomKey, ":", sender, data);

            connections[roomKey].forEach(id => {
                io.to(id).emit("chat-message", data, sender, socket.id);
            });
        }
    });

    socket.on('disconnect', () => {
        const disconnectedAt = new Date();
        const connectedAt = timeOnline[socket.id];
        const diffTime = connectedAt ? Math.abs(disconnectedAt - connectedAt) : 0;

        Object.entries(connections).forEach(([roomKey, userList]) => {
            if (userList.includes(socket.id)) {
                // Inform users in the room
                userList.forEach(id => {
                    io.to(id).emit("user-left", socket.id);
                });

                // Remove user from the room
                connections[roomKey] = userList.filter(id => id !== socket.id);

                console.log(roomKey, socket.id, Math.ceil(diffTime / 1000));

                // Clean up empty rooms and messages
                if (connections[roomKey].length === 0) {
                    delete connections[roomKey];
                    delete messages[roomKey];
                }
            }
        });

        delete timeOnline[socket.id];
    });
});

server.listen(app.get('port'), () => {
    console.log("listening on", app.get('port'));
});