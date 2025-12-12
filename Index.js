const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const express = require("express");
const axios = require("axios");
const QRCode = require("qrcode");

const app = express();
app.use(express.json());

let sock;

async function connectWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async ({ qr }) => {
        if (qr) {
            lastQR = await QRCode.toDataURL(qr);
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || !msg.key.remoteJid) return;

        const text = msg.message.conversation || "";

        const reply = await askAI(text);

        await sock.sendMessage(msg.key.remoteJid, { text: reply });
    });
}

let lastQR = null;

app.get("/qr", (req, res) => {
    res.json({ qr: lastQR });
});

async function askAI(prompt) {
    const res = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }]
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
            }
        }
    );
    return res.data.choices[0].message.content;
}

app.get("/", (req, res) => res.send("WhatsApp Bot Running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server running");
    connectWhatsApp();
});
