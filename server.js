const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
  "http://localhost:3000",             // local React app
  "http://192.168.0.197:3000",  // production Vercel frontend
  "https://voice-calling.netlify.app"       // any other frontend you want
], // frontend origin
    methods: ["GET", "POST"],
  },
});

let waitingUsers = []; // queue for users searching for call

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // User starts searching for a call
  socket.on("join-call", () => {
    console.log(`${socket.id} is searching for a call...`);

    // If there's someone already waiting, connect them
    if (waitingUsers.length > 0) {
      const partnerId = waitingUsers.shift();

      // Notify both clients they found a partner
      io.to(socket.id).emit("call-found", { partnerId });
      io.to(partnerId).emit("call-found", { partnerId: socket.id });
    } else {
      // Add this user to waiting list
      waitingUsers.push(socket.id);
      io.to(socket.id).emit("searching");
    }
  });

  // User cancels search before matching
  socket.on("cancel-call", () => {
    console.log(`${socket.id} canceled searching`);
    waitingUsers = waitingUsers.filter((id) => id !== socket.id);
  });

  // Forward WebRTC signals (offer, answer, ICE)
  socket.on("signal", ({ signal, partnerId }) => {
    io.to(partnerId).emit("signal", { signal, from: socket.id });
  });

  // End the call for both users
  socket.on("end-call", ({ partnerId }) => {
    console.log(`${socket.id} ended call with ${partnerId}`);
    io.to(partnerId).emit("call-ended");
  });

  // Handle user disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    // Remove from waiting list
    waitingUsers = waitingUsers.filter((id) => id !== socket.id);

    // Notify partner if in a call (optional — you can track active calls)
    io.emit("call-ended"); // fallback: end call if one disconnects
  });
});

server.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});
