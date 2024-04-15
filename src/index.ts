import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Server } from "socket.io";

const app = new Hono();
const port = 3001;
const server = serve({
  fetch: app.fetch,
  port,
});

const io = new Server(server, {
  cors: {
    allowedHeaders: "*",
  },
});

const emailToName: Map<string, { name: string; avatar: string }> = new Map();
const emailToSocket: Map<string, string> = new Map();
const socketToEmail: Map<string, string> = new Map();

io.on("connection", (socket) => {
  console.log(`socket connected: ${socket.id}`);

  socket.on("register:user", ({ email, name, avatar }) => {
    emailToSocket.set(email, socket.id);
    socketToEmail.set(socket.id, email);
    socket.broadcast.emit("user:connected", { email, name, avatar });
    const arrToSend = [...emailToName.keys()].map((email) => {
      const currUser = emailToName.get(email);
      return {
        name: currUser?.name || "",
        avatar: currUser?.avatar || "",
        email: email,
      };
    });
    io.sockets.to(socket.id).emit("list:users", arrToSend);

    emailToName.set(email, { name, avatar });
  });

  socket.on("chat-message", ({ msg, email }) => {
    const socketId = emailToSocket.get(email);
    console.log(msg, email);
    if (socketId) {
      io.sockets.to(socketId).emit("chat-message", msg);
    }
  });

  socket.on("error", function (err) {
    console.log(err);
  });

  socket.on("disconnect", (reason) => {
    console.log(`socket disconnected: ${socket.id} for ${reason}`);
    const currEmail = socketToEmail.get(socket.id);
    socket.broadcast.emit("user:disconnected", currEmail);
    emailToSocket.delete(currEmail!);
    socketToEmail.delete(socket.id);
    emailToName.delete(currEmail!);
  });

  // Web-Rtc
  socket.on("room:join", (data) => {
    const { email, room } = data;
    io.to(room).emit("user:joined", { email, id: socket.id });
    socket.join(room);
    io.to(socket.id).emit("room:join", data);
  });

  socket.on("room:leave", () => {
    socket.leave("1");
  });

  socket.on("user:call", ({ to, offer }) => {
    io.to(to).emit("incomming:call", { from: socket.id, offer });
  });

  socket.on("call:accepted", ({ to, ans }) => {
    io.to(to).emit("call:accepted", { from: socket.id, ans });
  });

  socket.on("peer:nego:needed", ({ to, offer }) => {
    console.log("peer:nego:needed");
    io.to(to).emit("peer:nego:needed", { from: socket.id, offer });
  });

  socket.on("peer:nego:done", ({ to, ans }) => {
    console.log("peer:nego:done");
    io.to(to).emit("peer:nego:final", { from: socket.id, ans });
  });
});
