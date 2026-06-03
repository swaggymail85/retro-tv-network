const express = require('express');
const app = express();
const path = require('path');
const https = require('https'); // Used to safely fetch playlist pages from Google

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

// Route: Fast Action endpoint to let users tell the server the video changed
app.post('/api/rooms/:id/next', (req, res) => {
  const room = rooms[req.params.id];
  if (!room) return res.status(404).json({ error: "Room not found" });
  
  room.currentVideoIndex = (room.currentVideoIndex + 1) % room.playlist.length;
  room.videoStartTime = Date.now();
  res.json({ success: true });
});

// Helper function: Scrapes a public YouTube playlist page to extract all 11-char video IDs safely
function extractIdsFromPlaylist(playlistId) {
  return new Promise((resolve) => {
    const url = `https://www.youtube.com/playlist?list=${playlistId}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Regex looks for occurrences of "/watch?v=XXXXXXXXXXX" in the page source data
        const regex = /\"videoId\":\"([a-zA-Z0-9_-]{11})\"/g;
        const ids = [];
        let match;
        while ((match = regex.exec(data)) !== null) {
          if (!ids.includes(match[1])) {
            ids.push(match[1]);
          }
        }
        resolve(ids);
      });
    }).on('error', () => resolve([]));
  });
}

// Route: Create a new room (Accepts a Single Video OR a Playlist Link!)
app.post('/api/rooms', async (req, res) => {
  const { name, urlInput } = req.body;
  if (!name || !urlInput) return res.status(400).json({ error: "Missing fields" });

  let playlist = [];
  
  // Check if it's a playlist URL
  if (urlInput.includes('list=')) {
    const playlistId = urlInput.split('list=')[1].split('&')[0];
    playlist = await extractIdsFromPlaylist(playlistId);
  } else {
    // Treat as a single video link
    const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
    const match = urlInput.match(regExp);
    const videoId = (match && match[1].length === 11) ? match[1] : urlInput.trim();
    if (videoId.length === 11) playlist.push(videoId);
  }

  if (playlist.length === 0) {
    return res.status(400).json({ error: "Could not extract any valid YouTube IDs from your input link." });
  }

  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  rooms[id] = {
    name: name,
    playlist: playlist,
    currentVideoIndex: 0,
    videoStartTime: Date.now(),
    videoDuration: 300 // Standard fallback window
  };

  res.json({ success: true, roomId: id });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TV Server running on port ${PORT}`));
