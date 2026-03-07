import express from 'express';

const app = express();
const PORT = 8000;

// Use JSON middleware
app.use(express.json());

// Route that returns a short message
app.get('/', (req, res) => {
  res.json({ message: 'Hello, this is a simple Express server!' });
});

// Start the server and log the URL
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
