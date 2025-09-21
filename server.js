// src/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

// Allow multiple frontend origins
const allowedOrigins = [
  "http://localhost:3000",
  "http://192.168.0.197:3000",
  "https://voice-calling.netlify.app",
];

// ✅ Apply CORS middleware
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  })
);

// ✅ Test route
app.get("/test", (req, res) => {
  res.json({ success: true, message: "Server is running fine 🚀" });
});

const server = http.createServer(app);

// ✅ Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

let waitingUsers = []; // queue for users searching for call

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // User starts searching for a call
  socket.on("join-call", () => {
    console.log(`${socket.id} is searching for a call...`);

    if (waitingUsers.length > 0) {
      const partnerId = waitingUsers.shift();
      io.to(socket.id).emit("call-found", { partnerId });
      io.to(partnerId).emit("call-found", { partnerId: socket.id });
    } else {
      waitingUsers.push(socket.id);
      io.to(socket.id).emit("searching");
    }
  });

  // User cancels search
  socket.on("cancel-call", () => {
    console.log(`${socket.id} canceled searching`);
    waitingUsers = waitingUsers.filter((id) => id !== socket.id);
  });

  // Forward WebRTC signals (offer, answer, ICE)
  socket.on("signal", ({ signal, partnerId }) => {
    // console.log(signal)
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
    waitingUsers = waitingUsers.filter((id) => id !== socket.id);
    io.emit("call-ended"); // fallback: end call if one disconnects
  });
});

// Use process.env.PORT for deployment
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
