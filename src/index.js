import express from 'express';
import { matcheRouter } from './routes/matches.js';

const app = express();
const PORT = 8000;

// Use JSON middleware
app.use(express.json());

// Route that returns a short message   
app.get('/', (req, res) => {
  res.json({ message: 'Hello, this is a simple Express server!' });
});

app.use('/matches', matcheRouter);

// Start the server and log the URL
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
