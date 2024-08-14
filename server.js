const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt'); 
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const saltRounds = 10; 
const app = express();
const port = 3000;

const url = 'mongodb://localhost:27017';
const dbName = 'SADEVS_DB';
const collectionName = 'user_data';

app.use(bodyParser.json());
app.use(express.static('public'));
app.use(cors({
    origin: 'http://localhost:3000', // Adjust based on your frontend origin
    credentials: true
}));


app.use(session({
  secret: '12dc17705b5a29f0dd94b433a5d5bf8f05f7667e45323d946fde06ffb96842e1',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

function ensureAuthenticated(req, res, next) {
    if (req.session.email) {
        return next();
    } else {
        return res.status(401).send('Unauthorized');
    }
}

// Session Status Route
app.get('/session-status', (req, res) => {
    if (req.session.email) {
        res.json({ loggedIn: true });
    } else {
        res.json({ loggedIn: false });
    }
});

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
              req.session.email = email;
              console.log('Session set:', req.session);
              return res.json({ message: "Login Successful" });
          } else {
              return res.status(401).json({ message: "Invalid Email or Password!" });
          }
      } else {
          return res.status(401).json({ message: "User Not Found!" });
      }
  } catch (err) {
      console.error("Error during login:", err);
      return res.status(500).json({ message: "An Error Occurred!" });
  }
});

function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.email) {
      return next();
  } else {
      res.status(401).json({ error: 'Unauthorized: No session available' });
  }
}

app.post('/update-profile', ensureAuthenticated, upload.single('photo'), async (req, res) => {
  console.log('Session in update-profile:', req.session);
  if (!req.session.email) {
    return res.status(401).send('Unauthorized');
}
  
  const phone = req.body.phone;
  const dob = req.body.dob;
  const gender = req.body.gender;
  const address = req.body.address;
  const photo = req.file;

  const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection(collectionName);
      console.log("Connection Created successfully");

      const user = await collection.findOne({ email: req.session.email });
      console.log("finding user");
      if (!user) {
        console.log("not found");
          return res.status(404).send('User not found');
      }
      console.log("found");

      const updateData = {
          $set: {
              phone: phone,
              dob: dob,
              gender: gender,
              address: address
          }
      };

      if (photo) {
          console.log("uploading photo");
          const photoPath = path.join(__dirname, 'uploads', `${user._id}-${photo.originalname}`);
          fs.writeFileSync(photoPath, photo.buffer);
          updateData.$set.photo = photoPath;
          console.log("photo uploaded successfully");
      }
      console.log("updating user document");
      await collection.updateOne({ email: req.session.email }, updateData);

      res.sendStatus(200);
  } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).send('Internal Server Error');
  } finally {
      client.close();
  }
});

app.get('/session-data', (req, res) => {
  if (req.session.email) {
      res.json({ sessionData: req.session });
  } else {
      res.status(401).json({ message: "No session data available." });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
      if (err) {
          return res.status(500).json({ message: 'Failed to log out' });
      }
      res.json({ message: 'Logout successful' });
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
