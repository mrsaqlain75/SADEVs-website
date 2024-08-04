const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const port = 3000;

const url = 'mongodb://localhost:27017';
const dbName = 'SADEVS_DB';
const collectionName = 'user_data';

app.use(bodyParser.json());
app.use(express.static('public'));

// Check if email already exists
app.post('/check-email', async (req, res) => {
  const { email } = req.body;

  try {
    const client = await MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    const user = await collection.findOne({ email });
    client.close();

    res.json({ exists: !!user });
  } catch (err) {
    res.status(500).json({ message: 'An error occurred', error: err });
  }
});

app.post('/save', async (req, res) => {
  const { name, email, pass, cpass, terms } = req.body;

  try {
    const client = await MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    const result = await collection.insertOne({ name, email, pass, cpass, terms });
    client.close();
    res.json({ message: 'Account Created Successfully!' });
  } catch (err) {
    res.status(500).json({ message: 'An error occurred', error: err });
  }
});

app.get('/fetch', async (req, res) => {
  try {
    const client = await MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    const users = await collection.find({}).toArray();
    client.close();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'An error occurred', error: err });
  }
});

app.delete('/delete/:id', async (req, res) => {
  const userId = req.params.id;

  try {
    const client = await MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    const result = await collection.deleteOne({ _id: new ObjectId(userId) });
    client.close();

    if (result.deletedCount === 1) {
      res.json({ message: 'User deleted successfully!' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (err) {
    res.status(500).json({ message: 'An error occurred', error: err });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
