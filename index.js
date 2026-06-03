const express = require('express');
const app = express();
const path = require('path');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Server-side database of channels
const rooms = {
  "retro-cartoons": {
    name: "90s Cartoon Network",
    playlist: ["rHLpvDsdTjQ", "NkZuyvH38kM", "y5khAMt-Kk4"],
    currentVideoIndex: 0,
    videoStartTime: Date.now(),
    videoDuration: 180 // Average 3 minutes per video for testing
  },
  "lofi-chill": {
    name: "Lofi Study Room",
    playlist: ["eY33prz3jiY", "fFOBSHQWNTQ"],
    currentVideoIndex: 0,
    videoStartTime: Date.now(),
    videoDuration: 240
  }
};

// Get live channels for lobby
app.get('/api/rooms', (req, res) => {
  const roomList = Object.keys(rooms).map(id => ({
    id,
    name: rooms[id].name
  }));
  res.json(roomList);
});

// Get time-sync state for a station
app.get('/api/rooms/:id', (req, res) => {
  const room = rooms[req.params.id];
  if (!room) return res.status(404).json({ error: "Room not found" });

  const now = Date.now();
  let elapsedSeconds = (now - room.videoStartTime) / 1000;

  // If time's up, cycle to next video automatically
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

// Create a new room from the input box
app.post('/api/rooms', (req, res) => {
  const { name, firstVideo } = req.body;
  if (!name || !firstVideo) return res.status(400).json({ error: "Missing fields" });

  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  rooms[id] = {
    name: name,
    playlist: [firstVideo],
    currentVideoIndex: 0,
    videoStartTime: Date.now(),
    videoDuration: 180
  };

  res.json({ success: true, roomId: id });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TV Server running on port ${PORT}`));
