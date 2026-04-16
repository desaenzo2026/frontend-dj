/**
 * Socket.IO handlers
 * Rooms:
 *   event:<eventId>  — live requests & votes
 *   list:<listId>    — collaborative song list
 */
module.exports = function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    // Join an event room (live requests)
    socket.on('join:event', (eventId) => {
      if (typeof eventId === 'string' && /^[0-9a-f-]{36}$/.test(eventId)) {
        socket.join(`event:${eventId}`);
      }
    });

    // Join a list room (collaborative list)
    socket.on('join:list', (listId) => {
      if (typeof listId === 'string' && /^[0-9a-f-]{36}$/.test(listId)) {
        socket.join(`list:${listId}`);
      }
    });

    socket.on('leave:event', (eventId) => socket.leave(`event:${eventId}`));
    socket.on('leave:list',  (listId)  => socket.leave(`list:${listId}`));

    socket.on('disconnect', () => {
      // Socket.IO cleans up rooms automatically
    });
  });
};
