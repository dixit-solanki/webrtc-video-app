let express = require('express');
let app = express();
let server = require('http').Server(app);
let io = require('socket.io')(server);
let stream = require('./ws/stream');
let path = require('path');
app.set('view engine', 'ejs');
app.use('/assets', express.static(path.join(__dirname, 'assets')));


app.get('/', (req, res) => {
    const room = req.query.room || 'default-room';
    res.render('index', { room });
});


app.get('/speaker/:userId', (req, res) => {
    const roomId = req.params.roomId;
    const userId = req.params.userId;
    res.render('user', { roomId, userId });
});
io.of('/stream').on('connection', stream);

server.listen(3001, () => {
    console.log('Server is running at http://localhost:3001');
});
