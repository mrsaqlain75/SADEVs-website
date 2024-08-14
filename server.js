const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt'); //To encrypt the passwords
const session = require('express-session');



const saltRounds = 10; // Number of rounds to generate salt

const app = express();
const port = 3000;

const url = 'mongodb://localhost:27017';
const dbName = 'SADEVS_DB';
const collectionName = 'user_data';

app.use(bodyParser.json());
app.use(express.static('public'));

app.use(session({
  secret: '12dc17705b5a29f0dd94b433a5d5bf8f05f7667e45323d946fde06ffb96842e1', // The secret key
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set secure to true if you're using HTTPS
}));



// Check if email already exists
app.post('/check-email', async (req, res) => {
  const { email } = req.body;

  try {
    const client = await MongoClient.connect(url);
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
    const client = await MongoClient.connect(url);
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const hashedPassword = await bcrypt.hash(pass, saltRounds);
    const hashedcPassword = await bcrypt.hash(cpass, saltRounds);

    const result = await collection.insertOne({ name, email, pass: hashedPassword, cpass: hashedcPassword, terms });
    client.close();
    res.json({ message: 'Account Created Successfully!' });
  } catch (err) {
    res.status(500).json({ message: 'An error occurred', error: err });
  }
});

app.get('/fetch', async (req, res) => {
  try {
    const client = await MongoClient.connect(url);
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
    const client = await MongoClient.connect(url);
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

app.post('/login', async (req, res) => {
  const { email, pass } = req.body;
  try {
    const client = await MongoClient.connect(url);
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const user = await collection.findOne({ email });
    if (user) {
      const isMatch = await bcrypt.compare(pass, user.pass);
      if (isMatch) {
        // Store email in the session
        req.session.email = email;

        res.json({ message: "Login Successful" });
      } else {
        res.status(401).json({ message: "Invalid Email or Password!" });
      }
    } else {
      res.status(401).json({ message: "User Not Found!" });
    }
  } catch (err) {
    res.status(500).json({ message: "An Error Occurred!" });
  }
});


//To access the session data, use this route
app.get('/session-data', (req, res) => {
  if (req.session.email) {
    res.json({ sessionData: req.session });
  } else {
    res.status(401).json({ message: "No active session found!" });
  }
});

//Logout route
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
      if (err) {
          return res.status(500).json({ message: "Logout failed!" });
      }
      res.clearCookie('connect.sid'); // Clear the session cookie
      res.json({ message: "Logged out successfully!" });
  });
});

app.get('/session-status', (req, res) => {
  if (req.session.email) {
    res.json({ loggedIn: true, email: req.session.email });
  } else {
    res.json({ loggedIn: false });
  }
});


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
