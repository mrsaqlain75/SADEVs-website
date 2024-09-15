const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt'); 
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const nodemailer = require('nodemailer');

const saltRounds = 10; 
const app = express();
const port = 3000;

const url = 'mongodb://localhost:27017';
const dbName = 'SADEVS_DB';
const collectionName = 'user_data';
const postsCollectionName = 'posts';



let verificationCodes = {}; // To store email and the verification code pairs

let verificationCodesFor = {}; // To store email and the verification code pairs -- Forgot Password


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

// Route to send verification code
app.post('/send-verification-code', async (req, res) => {
  const { name, email, password } = req.body;

  // Generate a random 6-digit verification code
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Storing the code along with the email
  verificationCodes[email] = verificationCode;

  try {
      // Setting up Nodemailer
      const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
              user: 'saqlainamin646@gmail.com', 
              pass: 'kthh lyjh jauk yjgo'
          }
      });

      // Sending the email
      await transporter.sendMail({
          from: 'saqlainamin646@gmail.com', 
          to: email,
          subject: 'Your Verification Code on SADEVz.com',
          text: `Hello ${name},\n\nYour verification code is: ${verificationCode}\n\nPlease enter this code to verify your account.`
      });

      res.json({ success: true, message: 'Verification code sent to email.' });
  } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error sending email.' });
  }
});


// Route to send verification code Forgot
app.post('/send-verification-code-for', async (req, res) => {
  const { name, email, password } = req.body;

  // Generate a random 6-digit verification code
  const verificationCodeFor = Math.floor(100000 + Math.random() * 900000).toString();

  // Storing the code along with the email
  verificationCodesFor[email] = verificationCodeFor;

  try {
      // Setting up Nodemailer
      const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
              user: 'saqlainamin646@gmail.com', 
              pass: 'kthh lyjh jauk yjgo'
          }
      });

      // Sending the email
      await transporter.sendMail({
          from: 'saqlainamin646@gmail.com', 
          to: email,
          subject: 'Your Verification Code on SADEVz.com',
          text: `Hello ${name},\n\nYour verification code is: ${verificationCodeFor}\n\nPlease enter this code to verify your account.`
      });

      res.json({ success: true, message: 'Verification code sent to email.' });
  } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error sending email.' });
  }
});

// Route to verify the code
app.post('/verify-code', (req, res) => {
  const { email, code } = req.body;

  if (verificationCodes[email] === code) {
      // Code matches, proceed with signup
      delete verificationCodes[email]; // Clear the stored code after verification
      res.json({ success: true });
  } else {
      res.status(400).json({ success: false, message: 'Invalid verification code.' });
  }

});

// Route to verify the code Forgot
app.post('/verify-code-for', (req, res) => {
  const { email, code } = req.body;

  if (verificationCodesFor[email] === code) {
      // Code matches, proceed with signup
      delete verificationCodesFor[email]; // Clear the stored code after verification
      res.json({ success: true });
  } else {
      res.status(400).json({ success: false, message: 'Invalid verification code.' });
  }

});



// Handle post submissions
app.post('/submit-post', ensureAuthenticated, uploadPost.array('images', 5), async (req, res) => {
  const { title, content } = req.body;
  const files = req.files;

  const imagePaths = files.map(file => '/postuploads/' + file.filename);

  try {
      const client = await MongoClient.connect(url);
      const db = client.db(dbName);
      const collection = db.collection(postsCollectionName);

      const newPost = {
          title, // Include title in the document
          content,
          images: imagePaths,
          authorEmail: req.session.email,
          createdAt: new Date(),
          views: 0,
          likes: 0,
          likedBy: [],
          viewedBy: [],
          approved: false
      };

      await collection.insertOne(newPost);

      client.close();
      res.status(200).json({ message: 'Post submitted successfully' });
  } catch (error) {
      console.error('Error submitting post:', error);
      res.status(500).json({ message: 'An error occurred while submitting the post' });
  }
});


// Route to update a post
app.put('/update-post', ensureAuthenticated, uploadPost.array('images', 5), async (req, res) => {
  const { title, content, postId } = req.body;
  const files = req.files;

  const newImagePaths = files.map(file => '/postuploads/' + file.filename);

  try {
      const client = await MongoClient.connect(url);
      const db = client.db(dbName);
      const collection = db.collection(postsCollectionName);

      // Find the existing post by ID
      const post = await collection.findOne({ _id: new ObjectId(postId) });

      if (!post) {
          return res.status(404).json({ success: false, message: 'Post not found' });
      }

      // Remove old images from the server (optional step, for cleanup)
      if (post.images && post.images.length > 0 && newImagePaths.length > 0) {
          post.images.forEach(imagePath => {
              const filePath = path.join(__dirname, imagePath);
              if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath); // Remove old image
              }
          });
      }

      // Update the post with new data and images
      const updatedPost = {
          title, // Update title
          content, // Update content
          images: newImagePaths.length > 0 ? newImagePaths : post.images, // If new images are provided, update them
          updatedAt: new Date(),
      };

      await collection.updateOne(
          { _id: new ObjectId(postId) },
          { $set: updatedPost }
      );

      client.close();

      res.status(200).json({ success: true, message: 'Post updated successfully' });
  } catch (error) {
      console.error('Error updating post:', error);
      res.status(500).json({ success: false, message: 'An error occurred while updating the post' });
  }
});



// Route to handle likes
app.post('/like-post', ensureAuthenticated, async (req, res) => {
  const postId = req.body.postId;
  const userEmail = req.session.email;

  try {
    const client = await MongoClient.connect(url);
    const db = client.db(dbName);
    const collection = db.collection("posts");

    // Ensure the postId is valid
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    // Fetch the post
    const post = await collection.findOne({ _id: new ObjectId(postId) });

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if the user has already liked the post
    const hasLiked = post.likedBy && post.likedBy.includes(userEmail);

    // Update the post depending on whether the user has already liked it or not
    const update = hasLiked
      ? { $inc: { likes: -1 }, $pull: { likedBy: userEmail } } // Remove like
      : { $inc: { likes: 1 }, $push: { likedBy: userEmail } }; // Add like

    await collection.updateOne({ _id: new ObjectId(postId) }, update);

    // Send response with updated like status
    res.json({ message: hasLiked ? 'Post unliked' : 'Post liked', liked: !hasLiked });
    
    client.close();
  } catch (error) {
    console.error('Error liking post:', error);
    res.status(500).json({ message: 'An error occurred while liking the post' });
  }
});

app.get('/check-like-status', ensureAuthenticated, async (req, res) => {
  const postId = req.query.postId;
  const userEmail = req.session.email;

  try {
    const client = await MongoClient.connect(url);
    const db = client.db(dbName);
    const collection = db.collection("posts");

    // Ensure the postId is valid
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    // Fetch the post
    const post = await collection.findOne({ _id: new ObjectId(postId) });

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if the user has already liked the post
    const hasLiked = post.likedBy && post.likedBy.includes(userEmail);

    res.json({ liked: hasLiked});

    client.close();
  } catch (error) {
    console.error('Error checking like status:', error);
    res.status(500).json({ message: 'An error occurred' });
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

app.post('/update-password', async (req, res) => {
  const { email, recCpass } = req.body; // Receive email and new password from the request body

  // Check if email and password are provided
  if (!email || !recCpass) {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }

  try {
    // Ensure saltRounds is defined (usually 10 or more)
    const saltRounds = 10; 

    // Hash the new password using bcrypt
    const hashedPassword = await bcrypt.hash(recCpass, saltRounds); // recCpass is the password, saltRounds is 10

    // Connect to the MongoDB client
    const client = await MongoClient.connect(url);
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Update the user's password in the database
    const result = await collection.updateOne(
      { email: email }, // Find the user by their email
      { $set: { pass: hashedPassword } } // Update the password field
    );
    client.close();

    // If no user is found with the provided email
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "User not found.", password : recCpass });
    }

    // Success message
    res.json({ success: true, message: "Password updated successfully." });
    
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
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

  const client = new MongoClient(url );

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
  const client = new MongoClient(url );

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
  const client = new MongoClient(url);

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

// route to delete a user by ID
app.delete('/delete/:id', async (req, res) => {
  const userId = req.params.id;

  const client = new MongoClient(url );

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


//Posts in dashboard

app.get('/fetch-posts-list', async (req, res) => {
  const client = new MongoClient(url);

  try {
      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection("posts");

      const posts = await collection.find({}).toArray();
      res.json(posts);
  } catch (error) {
      console.error('Error fetching posts:', error);
      res.status(500).json({ message: 'Internal Server Error' });
  } finally {
      client.close();
  }
});

// Add this route to delete a post by ID
app.delete('/delete-post/:id', async (req, res) => {
  const postId = req.params.id;

  const client = new MongoClient(url );

  try {
      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection("posts");

      await collection.deleteOne({ _id: new ObjectId(postId) });

      res.json({ message: 'Post deleted successfully' });
  } catch (error) {
      console.error('Error deleting post:', error);
      res.status(500).json({ message: 'Internal Server Error' });
  } finally {
      client.close();
  }
});





app.get('/get-posts', ensureAuthenticated, async (req, res) => {
  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection("posts");

    const posts = await collection.find({ authorEmail: req.session.email,  approved: true }).toArray();

    if (posts.length === 0) {
      return res.status(404).json({ message: "No posts found" });
    }

    res.json(posts);

  } catch (error) {
    console.error('Error fetching posts', error);
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.close();
  }
});



// Getting post from Database to display on the see-post.html
app.get('/get-post-from-db', async (req, res) => {
    const client = new MongoClient(url);

    try {
        await client.connect();
        const db = client.db(dbName);
        const postsCollection = db.collection("posts");
        const usersCollection = db.collection("user_data");

        // Retrieve the postId from the query parameters
        const postId = req.query.id;

        // Ensure that the postId is valid
        if (!ObjectId.isValid(postId)) {
            return res.status(400).json({ message: 'Invalid post ID' });
        }

        // Convert the postId to an ObjectId and query the database for the post
        const post = await postsCollection.findOne({ _id: new ObjectId(postId), approved : true });
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Query the user_data collection to get the author's name using the authorEmail from the post
        const user = await usersCollection.findOne({ email: post.authorEmail });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Send the post data along with the author's name to the client
        res.json({
            title: post.title,
            content: post.content,
            createdAt: post.createdAt,
            authorName: user.name  // Assuming the name field in user_data is 'name'
        });
    } catch (error) {
        console.error('Error fetching post or user data:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    } finally {
        client.close();
    }
});

//Real time search handling]
app.get('/search-realtime', async (req, res) => {
  const client = new MongoClient(url);
  const query = req.query.q || '';  // Get the query parameter from the URL
  console.log('Received search query:', query);  // Debug log to verify query
  try {
      await client.connect();
      const db = client.db(dbName);
      const postsCollection = db.collection("posts");
        // Sanitize the query input and perform the search
        const sanitizedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const posts = await postsCollection.find({ title: new RegExp(sanitizedQuery, 'i'), approved : true }).limit(10).toArray();
        res.json(posts);  // Send the search results back to the client
  } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
  }finally{
    client.close();
  }
});


// Route to approve a post
app.post('/approve-post', async (req, res) => {
  
  const client = new MongoClient(url);
  const postid = req.query.id;

  if (!postid) {
    return res.status(400).json({ error: 'Post ID is required' });
  }

  try {
    await client.connect();
    const db = client.db(dbName);
    const postsCollection = db.collection('posts');

    // Check if postid is a valid ObjectId
    if (!ObjectId.isValid(postid)) {
      return res.status(400).json({ error: 'Invalid Post ID' });
    }

    const result = await postsCollection.updateOne(
      { _id: new ObjectId(postid) },
      { $set: { approved: true } }
    );

    if (result.matchedCount > 0) {
      res.status(200).json({ message: "Post approved successfully" });
    } else {
      res.status(404).json({ message: "Post not found" });
    }
  } catch (err) {
    console.error('Error approving post:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Helper function to get the user's IP address
function getUserIp(req) {
  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if (ip === '::1') {
    ip = '127.0.0.1';
  }
  return ip;
}

// Route to get the likes:
app.get('/get-likes', async (req, res) => {
  const client = new MongoClient(url );
  const postId = req.query.id;

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection("posts");
    // Find the post by ID
    const post = await collection.findOne({ _id: new ObjectId(postId) });
    
    res.json(post);

  } catch (error) {
    console.log("Error retrieving",error);
    res.status(500).send('Server error');
  }
client.close();
});





// Route to get a specific post by ID and update views
app.get('/get-views', async (req, res) => {
  const client = new MongoClient(url );
  const postId = req.query.id;

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection("posts");
    const userIp = getUserIp(req); // Get the user's IP

    // Find the post by ID
    const post = await collection.findOne({ _id: new ObjectId(postId) });

    if (!post) {
      return res.status(404).send('Post not found');
    }

    // Check if the IP is already in the viewedBy array
    if (!post.viewedBy || !post.viewedBy.includes(userIp)) {
      // If not, increment the views and add the IP to viewedBy
      await collection.updateOne(
        { _id: new ObjectId(postId) },
        {
          $inc: { views: 1 },          // Increment view count by 1
          $push: { viewedBy: userIp }  // Add the IP to the viewedBy array
        }
      );
    }

    // Send the updated post back to the client
    const updatedPost = await collection.findOne({ _id: new ObjectId(postId) });
    res.json(updatedPost);

  } catch (error) {
    console.log("Error updating views",error);
    res.status(500).send('Server error');
  }
client.close();
});

// Assuming you have already connected to the MongoDB client and the posts collection

async function getTopPosts(req, res) {
  try {
    const client = new MongoClient(url);
    const db = client.db(dbName);
    const postsCollection = db.collection('posts'); 
    // Find the top 10 posts sorted by views in descending order
    const topPosts = await postsCollection
      .find({approved : true})        // Get all documents
      .sort({ views: -1 })            // Sort by the 'views' field in descending order
      .limit(10)                      // Limit the results to the top 10
      .toArray();                     // Convert the result to an array
    // Send the top 10 posts as a JSON response to the client
    res.json(topPosts);
  } catch (error) {
    console.error('Error fetching top posts:', error);
    res.status(500).send('Error fetching top posts');
  }
}


app.get('/top-posts', async (req, res) => {
const client = new MongoClient(url);
try {
    await client.connect();
    await getTopPosts(req, res); // Call the function defined above
} catch (err) {
    res.status(500).json({ error: 'Internal server error' });
}finally{
  client.close();
}
});

// To change the password of user
app.post('/change-password', async (req, res) => {
  const { oldPass, newPass } = req.body;
  console.log("Session email: ", req.session.email);  // Log the session email
  try {
    const client = new MongoClient(url);
    await client.connect(); // Connect to MongoDB
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const user = await collection.findOne({ email: req.session.email });
    
    if (user) {
      // Compare the provided old password with the stored hashed password
      const isMatch = await bcrypt.compare(oldPass, user.pass);
      
      if (isMatch) {
        // Hash the new password
        const hashedNewPass = await bcrypt.hash(newPass, saltRounds);

        // Update the password in the database
        const result = await collection.updateOne(
          { email: req.session.email },
          { $set: { pass: hashedNewPass } }
        );

        await client.close(); // Close the MongoDB connection
        
        res.json({ success: true, message: "Password updated successfully" });
      } else {
        await client.close();
        res.status(400).json({ success: false, message: "Old password is incorrect" });
      }
    } else {
      await client.close();
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});



