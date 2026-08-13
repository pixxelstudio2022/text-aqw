const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const dbPath = path.resolve(__dirname, 'game.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error opening database", err.message);
    } else {
        console.log("Connected to local SQLite database.");
    }
});

db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    hp INTEGER DEFAULT 100,
    max_hp INTEGER DEFAULT 100,
    gold INTEGER DEFAULT 0,
    location TEXT DEFAULT 'Battleon Town'
)`);

app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (ws) => {
    let dbPlayerId = null;

    ws.on('message', (message) => {
        let data = JSON.parse(message);

        if (data.action === 'login') {
            let username = (data.username || "Hero").trim();
            
            db.get(`SELECT * FROM players WHERE username = ?`, [username], (err, row) => {
                if (err) return console.error(err);

                if (!row) {
                    db.run(`INSERT INTO players (username, hp, max_hp, gold, location) VALUES (?, 100, 100, 0, ?)`, 
                    [username, 'Battleon Town'], function(err) {
                        if (err) return console.error(err);
                        dbPlayerId = this.lastID;
                        fetchPlayer(dbPlayerId, ws, "Welcome to the world, " + username + "!");
                    });
                } else {
                    dbPlayerId = row.id;
                    fetchPlayer(dbPlayerId, ws, "Welcome back, " + username + "!");
                }
            });
        } 
        else if (data.action === 'fight' && dbPlayerId) {
            let damageDealt = Math.floor(Math.random() * 15) + 10;
            
            db.run(`UPDATE players SET gold = gold + 10 WHERE id = ?`, [dbPlayerId], (err) => {
                if (err) return console.error(err);
                
                ws.send(JSON.stringify({ type: 'log', text: `⚔️ You defeated a Skeleton for ${damageDealt} damage! Gained 10 Gold.` }));
                fetchPlayer(dbPlayerId, ws);
            });
        }
    });
});

function fetchPlayer(id, ws, welcomeText = null) {
    db.get(`SELECT * FROM players WHERE id = ?`, [id], (err, row) => {
        if (err || !row) return;
        if (welcomeText) {
            ws.send(JSON.stringify({ type: 'log', text: welcomeText }));
        }
        ws.send(JSON.stringify({ type: 'init', player: row }));
        ws.send(JSON.stringify({ type: 'update', player: row }));
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
