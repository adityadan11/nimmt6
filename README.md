# 🌶️ 6 Nimmt! — Online Multiplayer

A real-time multiplayer version of the card game 6 Nimmt!, built with Node.js, Express and Socket.IO.

## Run locally

```bash
npm install
npm start
```

Then open http://localhost:3000.

## Deploy to Render (free)

1. Push this repo to GitHub.
2. Go to https://dashboard.render.com, then **New → Blueprint**.
3. Pick this repo. Render reads `render.yaml` and sets everything up.
4. Click **Apply**. In a couple of minutes you get a URL like `https://nimmt6.onrender.com`.

> Free instances go to sleep after about 15 minutes with no traffic. The first visit after that takes around 30 seconds to wake the server up. Rooms only live in memory, so any game in progress is lost when the server sleeps or restarts.

## How to play

1. Enter a nickname and click **Create Room**.
2. Send your friends the 5-letter room code.
3. Once 2–10 players have joined, the host clicks **Start Game**.
4. Every turn, each player picks a card at the same time. Cards are placed in ascending order, and whoever plays the 6th card in a row takes that row's bull heads.
5. After 10 rounds, the player with the fewest bull heads wins.
