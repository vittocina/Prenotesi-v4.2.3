const express = require('express');
const cors = require('cors');
const app = express();

// Configura CORS per consentire richieste da https://webviewer.pickcode.app
app.use(cors({
  origin: 'https://webviewer.pickcode.app',
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// Middleware per gestire JSON
app.use(express.json());

app.post('/api/generate-challenge', (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  // Genera una challenge casuale
  const challenge = crypto.randomBytes(32).toString('base64');

  // Restituisci la challenge
  res.json({ challenge });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});