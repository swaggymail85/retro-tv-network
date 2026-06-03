const express = require('express');
const app = express();
const path = require('path');
const https = require('https');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Server-side database of channels
const rooms = {
  "retro-cartoons": {
    name: "90s Cartoon Network",
    playlist: ["rHLpvDsdTjQ", "NkZuyvH38kM", "y5khAMt-Kk4"],
    currentVideoIndex: 0,
    videoStartTime: Date.now(),
    videoDuration: 180 
  },
  "lofi-chill": {
    name: "Lofi Study Room",
    playlist: ["eY33prz3jiY", "fFOBSHQWNTQ"],
    currentVideoIndex: 0,
    videoStartTime: Date.now(),
    videoDuration: 240
  }
};

// Route: Get active channels for lobby
app.get('/api/rooms', (req, res) => {
  const roomList = Object.keys(rooms).map(id => ({
    id,
    name: rooms[id].name,
    tracksCount: rooms[id].playlist.length
  }));
  res.json(roomList);
});

// Route: Get time-sync state for a station
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

// Route: Let users trigger the next channel track manually
app.post('/api/rooms/:id/next', (req, res) => {
  const room = rooms[req.params.id];
  if (!room) return res.status(404).json({ error: "Room not found" });
  
  room.currentVideoIndex = (room.currentVideoIndex + 1) % room.playlist.length;
  room.videoStartTime = Date.now();
  res.json({ success: true });
});

// Helper function: Fetches the embedded endpoint to pull all 11-char video IDs cleanly
function extractIdsFromPlaylist(playlistId) {
  return new Promise((resolve) => {
    // We target the embed version of the playlist which contains raw layout lists
    const url = `https://www.youtube.com/embed/videoseries?list=${playlistId}`;
    
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // This regex scans the backend configuration block YouTube transmits for embeds
        const regex = /\"videoId\":\"([a-zA-Z0-9_-]{11})\"/g;
        const ids = new Set(); // Using a Set just like your console script to prevent duplicates!
        let match;
        
        while ((match = regex.exec(data)) !== null) {
          ids.add(match[1]);
        }
        
        resolve(Array.from(ids));
      });
    }).on('error', () => resolve([]));
  });
}

// Route: Create a new room (Accepts a Single Video OR a Playlist Link!)
app.post('/api/rooms', async (req, res) => {
  const { name, urlInput } = req.body;
  if (!name || !urlInput) return res.status(400).json({ error: "Missing fields" });

  let playlist = [];
  
  // Extract playlist ID if link contains 'list='
  if (urlInput.includes('list=')) {
    const urlParams = urlInput.split('list=')[1];
    const playlistId = urlParams.split('&')[0];
    playlist = await extractIdsFromPlaylist(playlistId);
  } else {
    // Treat as a single video link
    const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
    const match = urlInput.match(regExp);
    const videoId = (match && match[1].length === 11) ? match[1] : urlInput.trim();
    if (videoId.length === 11) playlist.push(videoId);
  }

  if (playlist.length === 0) {
    return res.status(400).json({ error: "Could not find any videos. Make sure the playlist is set to Public or Unlisted!" });
  }

  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  rooms[id] = {
    name: name,
    playlist: playlist,
    currentVideoIndex: 0,
    videoStartTime: Date.now(),
    videoDuration: 300 // Standard fallback window before skipping
  };

  res.json({ success: true, roomId: id });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TV Server running on port ${PORT}`));
