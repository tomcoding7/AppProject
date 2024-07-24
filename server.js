const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static(__dirname + '/public'));

let users = [];

io.on('connection', socket => {
    console.log('New user connected:', socket.id);
    users.push(socket.id);
    io.emit('users', users);

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        users = users.filter(user => user !== socket.id);
        io.emit('users', users);
    });

    socket.on('message', message => {
        if (message.offer) {
            io.to(message.to).emit('message', { offer: message.offer, from: socket.id });
        } else if (message.answer) {
            io.to(message.to).emit('message', { answer: message.answer, from: socket.id });
        } else if (message.iceCandidate) {
            io.to(message.to).emit('message', { iceCandidate: message.iceCandidate, from: socket.id });
        }
    });

    socket.on('invite', to => {
        io.to(to).emit('invite', socket.id);
    });
});

server.listen(3000, () => {
    console.log('Server is listening on port 3000');
});
