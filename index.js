const express = require('express');
const app = express();
const path = require('path');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const rooms = {
  "retro-cartoons": {
    name: "90s Cartoon Network",
    playlist: ["rHLpvDsdTjQ", "NkZuyvH38kM", "y5khAMt-Kk4"],
    currentVideoIndex: 0,
    videoStartTime: Date.now(),
    videoDuration: 1200 // 20-minute fallback window for default rooms
  },
  "lofi-chill": {
    name: "Lofi Study Room",
    playlist: ["eY33prz3jiY", "fFOBSHQWNTQ"],
    currentVideoIndex: 0,
    videoStartTime: Date.now(),
    videoDuration: 1200
  }
};

app.get('/api/rooms', (req, res) => {
  const roomList = Object.keys(rooms).map(id => ({
    id,
    name: rooms[id].name,
    tracksCount: rooms[id].playlist.length
  }));
  res.json(roomList);
});

app.get('/api/rooms/:id', (req, res) => {
  const room = rooms[req.params.id];
  if (!room) return res.status(404).json({ error: "Room not found" });

  const now = Date.now();
  let elapsedSeconds = (now - room.videoStartTime) / 1000;

  if (elapsedSeconds >= room.videoDuration) {
    room.currentVideoIndex = (room.currentVideoIndex + 1) % room.playlist.length;
    room.videoStartTime = now;
    elapsedSeconds = 0;
  }

  res.json({
    name: room.name,
    videoId: room.playlist[room.currentVideoIndex],
    seekTo: Math.floor(elapsedSeconds)
  });
});

// Sync handler endpoint to safely cycle tracks manually via TV buttons
app.post('/api/rooms/:id/next', (req, res) => {
  const room = rooms[req.params.id];
  if (!room) return res.status(404).json({ error: "Room not found" });

  room.currentVideoIndex = (room.currentVideoIndex + 1) % room.playlist.length;
  room.videoStartTime = Date.now();
  res.json({ success: true });
});

app.post('/api/rooms', (req, res) => {
  const { name, playlist } = req.body;
  if (!name || !playlist || playlist.length === 0) return res.status(400).json({ error: "Missing data fields" });

  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  rooms[id] = {
    name: name,
    playlist: playlist,
    currentVideoIndex: 0,
    videoStartTime: Date.now(),
    videoDuration: 1200 // 20 minutes block time
  };

  res.json({ success: true, roomId: id });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TV Server running on port ${PORT}`));
