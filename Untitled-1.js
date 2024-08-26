
// Collection name for articles
const articlesCollectionName = 'posts';

// Article submission route
app.post('/submit-article', async (req, res) => {
    const { content } = req.body;

    try {
        const client = await MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
        const db = client.db(dbName);
        const postsCollection = db.collection('posts');

        const email = req.session.email;

        // Insert the article content into the 'posts' collection
        await postsCollection.insertOne({ email, content });

        client.close();
        res.json({ message: 'Article submitted successfully!' });
    } catch (err) {
        console.error('Error submitting article:', err);
        res.status(500).json({ message: 'An error occurred while submitting the article.' });
    }
});

app.post('/upload', upload.single('upload'), (req, res) => {
  const file = req.file;

  // If file is not uploaded
  if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
  }

  // Generate a response expected by CKEditor
  res.json({
      uploaded: 1,
      fileName: file.originalname,
      url: `/uploads/${file.filename}`
  });
});

// Image upload route
app.post('/upload-image', upload.single('upload'), (req, res) => {
    if (!req.file) {
        console.log('No file uploaded');
        return res.status(400).json({ uploaded: false, error: 'No file uploaded' });
    }

    const filename = `${Date.now()}-${req.file.originalname}`;
    const uploadPath = path.join(__dirname, 'postuploads', filename);
    console.log(`Saving file to ${uploadPath}`);

    fs.writeFileSync(uploadPath, req.file.buffer);

    res.json({
        uploaded: true,
        url: `/postuploads/${filename}`
    });
});


