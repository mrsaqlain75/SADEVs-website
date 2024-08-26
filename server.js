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
const postsCollectionName = 'posts';


app.use(bodyParser.json());
app.use(express.static('public'));
app.use(cors({
    origin: 'http://localhost:3000', // Adjust based on your frontend origin
    credentials: true
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/postuploads', express.static(path.join(__dirname, 'postuploads')));

app.use(session({
  secret: '12dc17705b5a29f0dd94b433a5d5bf8f05f7667e45323d946fde06ffb96842e1',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


const storagePost = multer.diskStorage({
  destination: function (req, file, cb) {
      cb(null, 'postuploads/');
  },
  filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const uploadPost = multer({ storage: storagePost });


// Handle post submissions
app.post('/submit-post', ensureAuthenticated, uploadPost.array('images', 5), async (req, res) => {
  const { content } = req.body;
  const files = req.files;

  const imagePaths = files.map(file => '/postuploads/' + file.filename);

  try {
      const client = await MongoClient.connect(url);
      const db = client.db(dbName);
      const collection = db.collection(postsCollectionName);

      const newPost = {
          content,
          images: imagePaths,
          authorEmail: req.session.email,
          createdAt: new Date()
      };

      await collection.insertOne(newPost);

      client.close();
      res.status(200).json({ message: 'Post submitted successfully' });
  } catch (error) {
      console.error('Error submitting post:', error);
      res.status(500).json({ message: 'An error occurred while submitting the post' });
  }
});

// Route to handle image upload
app.post('/upload', uploadPost.single('image'), (req, res) => {
  if (req.file) {
      const imageUrl = `/postuploads/${req.file.filename}`;
      console.log(imageUrl);
      res.json({ success: true, imageUrl: imageUrl });
  } else {
      res.status(500).json({ success: false, message: 'Upload failed' });
  }
});



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



// Add this route to server.js
app.get('/get-profile-data', ensureAuthenticated, async (req, res) => {
  const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection(collectionName);

      const user = await collection.findOne({ email: req.session.email });
      if (!user) {
          return res.status(404).json({ message: 'User not found' });
      }

      res.json({
          name: user.name,
          photo: user.photo ? `/uploads/${path.basename(user.photo)}` : 'Images/user-placeholder.png' // default image if no photo
      });
  } catch (error) {
      console.error('Error fetching profile data:', error);
      res.status(500).json({ message: 'Internal Server Error' });
  } finally {
      client.close();
  }
});


app.get('/fetch', async (req, res) => {
  const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection(collectionName);

      const users = await collection.find({}).toArray();
      res.json(users);
  } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Internal Server Error' });
  } finally {
      client.close();
  }
});

// Add this route to delete a user by ID
app.delete('/delete/:id', async (req, res) => {
  const userId = req.params.id;

  const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection(collectionName);

      await collection.deleteOne({ _id: new ObjectId(userId) });

      res.json({ message: 'User deleted successfully' });
  } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Internal Server Error' });
  } finally {
      client.close();
  }
});


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
