const stream = ( socket ) => {
    socket.on( 'subscribe', ( data ) => {
        //subscribe/join a room
        socket.join( data.room );
        socket.join( data.username );
        if ( socket.adapter.rooms.has(data.room) === true ) {
            socket.to( data.room ).emit( 'new user', { username: data.username } );
        }
    } );

    const pageLoadId = Date.now();

    socket.on( 'newUserStart', ( data ) => {
        socket.to( data.to ).emit( 'newUserStart', { sender: data.sender, pageLoadId: pageLoadId } );
    } );


    socket.on( 'sdp', ( data ) => {
        console.log("--data.sender",data.sender);
        socket.to( data.to ).emit( 'sdp', { description: data.description, sender: data.sender } );
    } );


    socket.on( 'ice candidates', ( data ) => {
        console.log("--data.candidates",data.sender);
        socket.to( data.to ).emit( 'ice candidates', { candidate: data.candidate, sender: data.sender } );
    } );

};

module.exports = stream;
