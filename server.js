// server.js
const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId, GridFSBucket } = require('mongodb');
// ✅ Helper function to safely convert to ObjectId
function toObjectId(id) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

const bcrypt = require('bcrypt');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const sanitize = require('sanitize-filename');
const mongoose = require('mongoose');

const app = express();
const port = 3000;

// ========== CRITICAL ROUTE (KEEP AT TOP) ========== //
app.get('/api/activities/submitted-validator', async (req, res) => {
  console.log('🔍 Route hit: /api/activities/submitted-validator');
  try {
    const db = await connectToMongoDB();
    if (!db) {
      console.error('❌ No DB returned from connectToMongoDB()');
      return res.status(500).json({ error: 'Database connection failed' });
    }

    const activities = await db.collection('activities').aggregate([
      { $match: { status: 'Submitted' } },
      {
        $lookup: {
          from: 'users',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student'
        }
      },
      {
        $unwind: {
          path: '$student',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          studentName: '$student.name',
          school: '$student.school',
          course: '$student.course',
          schoolYear: '$student.schoolYear'
        }
      },
      {
        $project: {
          student: 0 // Remove the full student object, keep only the added fields
        }
      }
    ]).toArray();

    console.log(`🎯 Retrieved ${activities.length} activities`);
    res.json(activities);
  } catch (err) {
    console.error('❌ Catch block triggered:', err);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// ✅ Place API routes BEFORE static middleware
app.get('/api/student/awards/:studentId', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const studentId = req.params.studentId;

    // Now querying the correct collection
    const awards = await db.collection('approved_submissions')
      .find({
        studentId: studentId,
        medal: { $exists: true, $ne: "" }
      })
      .toArray();

    if (!awards.length) {
      return res.status(404).json({ message: 'No award found for this student.' });
    }

    res.json(awards);
  } catch (error) {
    console.error('Error fetching awards:', error);
    res.status(500).json({ error: 'Failed to fetch awards' });
  }
});

app.get('/api/activities/byStudent', async (req, res) => {
  const { studentId } = req.query;

  if (!studentId) {
    return res.status(400).json({ error: 'studentId is required' });
  }

  if (!ObjectId.isValid(studentId)) {
    return res.status(400).json({ error: 'Invalid studentId format' });
  }

  try {
    const db = await connectToMongoDB();

    const activities = await db.collection('activities').aggregate([
      {
        $match: {
          studentId: new ObjectId(studentId)
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student'
        }
      },
      {
        $unwind: {
          path: '$student',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          studentId: 1,
          studentName: '$student.name',
          category: 1,
          activity: 1,
          venue: 1,
          date: 1,
          points: 1,
          status: 1,
          evidence: 1,
          createdAt: 1
        }
      }
    ]).toArray();

    res.json(activities);
  } catch (err) {
    console.error('Error fetching student activities:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Get a single activity by its ID
app.get('/api/activity/:id', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid activity ID' });
    }

    const activity = await db.collection('activities').findOne({ _id: new ObjectId(id) });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.json(activity);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// ========== MIDDLEWARE SETUP ========== //
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// ========== MONGODB CONFIGURATION ========== //
const uri1 = 'mongodb+srv://gonzales2213926:NZ3dmW2HuISrJjFp@cluster0.dsfrcbt.mongodb.net/student_affairs?retryWrites=true&w=majority&appName=Cluster0';
const uri2 = 'mongodb+srv://root:123@cluster0.bm9z5ag.mongodb.net/studentdb?retryWrites=true&w=majority&appName=Cluster0';
const client1 = new MongoClient(uri1, { serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true } });
const client2 = new MongoClient(uri1);
const client3 = new MongoClient(uri2);

let db = null;
let db2 = null;
let db3 = null;
let bucket = null;

async function connectToMongoDB() {
  if (db) return db;
  await client1.connect();
  console.log("Connected to MongoDB: student_affairs");
  db = client1.db('student_affairs');
  bucket = new GridFSBucket(db, { bucketName: 'uploads' });
  return db;
}

async function connectToMongoDB2() {
  if (db2) return db2;
  await client1.connect();
  console.log("Connected to MongoDB: studentdb");
  db2 = client1.db('student_affairs');
  return db2;
}

async function connectToMongoDB3() {
  if (db3) return db3;
  await client3.connect();
  console.log("Connected to MongoDB: awardsdb");
  db3 = client3.db('awardsdb');
  return db3;
}

async function connectToStudentAccountsDB() {
  return client1.connect().then(() => client2.db('student_affairs'));
}

app.post('/approve-submission', async (req, res) => {
  try {
    const db = await connectToMongoDB(); // Should connect to student_affairs
    const { submission, medal } = req.body;
    if (!submission || !medal) {
      return res.status(400).json({ success: false, message: 'Submission and medal are required.' });
    }

    // 1. Update all activities in the group to "Approved"
    const activityIds = submission.activities.map(act => new ObjectId(act._id));
    await db.collection('activities').updateMany(
      { _id: { $in: activityIds } },
      { $set: { status: "Approved" } }
    );

    // 2. Store the approved group in approved_submissions
    await db.collection('approved_submissions').insertOne({
      studentId: submission.studentId,
      studentName: submission.studentName,
      school: submission.school,
      course: submission.course,
      schoolYear: submission.schoolYear,
      category: submission.category,
      activities: submission.activities,
      points: submission.points,
      date: submission.date,
      medal,
      approvedAt: new Date(),
      approvedBy: "Validator" // Replace with actual validator info if available
    });

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error approving submission:', err);
    res.status(500).json({ success: false, message: "Failed to approve submission." });
  }
});

// ========== FILE UPLOAD CONFIGURATION ========== //
mongoose.set('strictQuery', false);
mongoose.connect(uri1, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const conn = mongoose.connection;

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.fieldname !== 'evidence') {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

// ========== ROUTE HANDLERS ========== //
function calculatePoints(category, submissionData) {
  const pointsMap = {
    'co-curricular': {
      'Organizer': 5,
      'Participant': 3,
      'Facilitator': 4
    },
    'community': {
      'Local': 4,
      'National': 7,
      'International': 10
    },
    'creative': {
      'Creator': 6,
      'Contributor': 4
    },
    'combined': {
      'High': 8,
      'Medium': 5,
      'Low': 3
    },
    'marshals': {
      'Lead': 5,
      'Regular': 3
    },
    'officers': {
      'President': 7,
      'Officer': 5,
      'Member': 3
    },
    'councils': {
      'President': 8,
      'Officer': 6,
      'Member': 4
    },
    'athletes': {
      'Varsity': 7,
      'Regular': 5
    }
  };

  switch(category) {
    case 'co-curricular':
    case 'community':
      return pointsMap[category][submissionData.role] || 0;
    case 'officers':
    case 'councils':
      return pointsMap[category][submissionData.position] || 0;
    case 'creative':
      return pointsMap[category][submissionData.nature] || 0;
    case 'marshals':
    case 'athletes':
      return pointsMap[category][submissionData.role] || 0;
    case 'combined':
      return pointsMap[category][submissionData.nature] || 0;
    default:
      return 0;
  }
}

// ========== API ROUTES ========== //
// Core routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password are required' });

  try {
    const db = await connectToMongoDB();
    const user = await db.collection('users').findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    if (!user.active) {
      return res.status(403).json({ success: false, message: 'Account is disabled. Contact admin.' });
    }
    
    const userData = {
      ...user,
      _id: user._id.toString()
    };
    delete userData.password;
    
    let redirectTo = '/dashboard/STUDASHBOARD.html';
    if (username === 'rater') {
      redirectTo = '/rater/rater.html';
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: userData,
      redirectTo
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/signup', async (req, res) => {
  const { name, school, course, schoolYear, username, password } = req.body;
  if (!name || !school || !course || !schoolYear || !username || !password) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  try {
    const db = await connectToMongoDB();
    const existingUser = await db.collection('users').findOne({ username });
    if (existingUser) return res.status(409).json({ success: false, message: 'Username already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { name, school, course, schoolYear, username, password: hashedPassword, createdAt: new Date(), active: true  };
    const result = await db.collection('users').insertOne(newUser);
    const { password: _, ...userData } = newUser;

    return result.acknowledged
      ? res.status(201).json({ success: true, message: 'Registration successful', user: userData })
      : res.status(500).json({ success: false, message: 'Failed to register user' });
  } catch (error) {
    console.error('Signup error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Activity routes

// Download a file from GridFS by its ObjectId
app.get('/api/files/:id', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const fileId = new ObjectId(req.params.id);

    const fileDoc = await db.collection('uploads.files').findOne({ _id: fileId });
    if (!fileDoc) return res.status(404).send('File not found');

    res.set('Content-Type', fileDoc.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${fileDoc.filename}"`);

    const bucket = new GridFSBucket(db, { bucketName: 'uploads' });
    const stream = bucket.openDownloadStream(fileId);
    stream.pipe(res).on('error', err => {
      console.error('GridFS stream error:', err.message);
      res.status(500).send('Error downloading file');
    });
  } catch (err) {
    console.error('Error fetching file by ID:', err.message);
    res.status(500).send('Server error');
  }
});

app.post('/api/activities', upload.array('evidence', 5), async (req, res) => {
  try {
    // 🔹 Step 1: Destructure all needed fields including raterId and validatorId
    const { studentId, category, status, raterId, validatorId, ...submissionData } = req.body;

    // 🔹 Step 2: Parse points
    const points = Math.floor(Math.random() * 50) + 1;

    const activityStatus = status || 'Not Submitted';
    const db = await connectToMongoDB();
    let filenames = [];

    // 🔹 Step 3: Upload evidence files if there are any
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const filename = `${Date.now()}-${sanitize(file.originalname)}`;
        const uploadStream = bucket.openUploadStream(filename, {
          contentType: file.mimetype
        });
        uploadStream.end(file.buffer);
        filenames.push(filename);
      }
    }

    // 🔹 Step 4: Create activity object
    const activity = {
      studentId: toObjectId(studentId),
      category,
      ...submissionData,
      points,
      evidence: filenames,
      status: activityStatus,
      createdAt: new Date(),

      recipientId: toObjectId(raterId),
      validatorId: toObjectId(validatorId)
    };

    // 🔹 Step 5: Save to database
    const result = await db.collection('activities').insertOne(activity);

    // 🔹 Step 6: Respond to client
    res.status(201).json({
      success: true,
      activity: {
        _id: result.insertedId,
        ...activity
      }
    });

  } catch (error) {
    console.error('Activity submission error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

app.get('/api/evidence/:filename', async (req, res) => {
  try {
    const filename = sanitize(req.params.filename);
    if (!filename) return res.status(400).send('Invalid filename');

    const db = await connectToMongoDB();
    const fileDoc = await db.collection('uploads.files').findOne({ filename });
    if (!fileDoc) return res.status(404).send('File not found');

    res.set('Content-Type', fileDoc.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${fileDoc.filename}"`);

    const downloadStream = bucket.openDownloadStreamByName(filename);
    downloadStream.pipe(res).on('error', (err) => {
      console.error('Download stream error:', err);
      res.status(500).send('Error downloading file');
    });
  } catch (error) {
    console.error('GridFS download error:', error);
    res.status(500).send('Server error');
  }
});

app.get('/api/activities/:studentId', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const activities = await db.collection('activities')
      .find({ studentId: new ObjectId(req.params.studentId) })
      .toArray();
      
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});


app.get('/api/activities/byid/:id', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const activity = await db.collection('activities').findOne({ _id: new ObjectId(req.params.id) });

    if (!activity) {
      return res.status(404).json({ success: false, message: 'Activity not found' });
    }

    res.json({ success: true, activity });
  } catch (error) {
    console.error('Failed to fetch activity:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/activities/:id', upload.array('evidence', 5), async (req, res) => {
  try {
    const activityId = req.params.id;
    const {
      studentId,
      category,
      status,
      raterId,
      validatorId,
      ...submissionData
    } = req.body;

    const db = await connectToMongoDB();
    const activity = await db.collection('activities').findOne({ _id: new ObjectId(activityId) });

    if (!activity) {
      return res.status(404).json({ success: false, message: 'Activity not found' });
    }

    // 🔹 Handle points
    const points = parseInt(req.body.points, 10);
    if (isNaN(points)) {
      return res.status(400).json({ success: false, message: 'Invalid points value' });
    }

    // 🔹 Handle evidence file updates
    let filenames = [];
    if (req.files && req.files.length > 0) {
      // Optional: Delete old evidence files here from GridFS if needed
      for (const file of req.files) {
        const filename = `${Date.now()}-${sanitize(file.originalname)}`;
        const uploadStream = bucket.openUploadStream(filename, {
          contentType: file.mimetype
        });
        uploadStream.end(file.buffer);
        filenames.push(filename);
      }
    }

    // 🔹 Prepare update object
    const updatedFields = {
      category,
      ...submissionData,
      points,
      evidence: filenames.length > 0 ? filenames : activity.evidence, // keep old evidence if none uploaded
      status: status || activity.status,
      updatedAt: new Date()
    };

    // ✅ Only include raterId if provided and valid
    if (raterId && ObjectId.isValid(raterId)) {
      updatedFields.recipientId = new ObjectId(raterId);
    }

    // ✅ Only include validatorId if provided and valid
    if (validatorId && ObjectId.isValid(validatorId)) {
      updatedFields.validatorId = new ObjectId(validatorId);
    }

    // 🔹 Perform update
    await db.collection('activities').updateOne(
      { _id: new ObjectId(activityId) },
      { $set: updatedFields }
    );

    res.status(200).json({
      success: true,
      message: 'Activity updated successfully',
      updatedFields
    });

  } catch (error) {
    console.error('Edit activity error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


app.delete('/api/activities/:id', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const activity = await db.collection('activities').findOne({
      _id: new ObjectId(req.params.id)
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const bucket = new GridFSBucket(db, { bucketName: 'uploads' });
    if (Array.isArray(activity.evidence)) {
      for (const filename of activity.evidence) {
        const file = await db.collection('uploads.files').findOne({ filename });
        if (file) {
          await bucket.delete(file._id);
          console.log(`🗑️ Deleted GridFS file: ${filename}`);
        }
      }
    } else if (typeof activity.evidence === 'string') {
      const file = await db.collection('uploads.files').findOne({ filename: activity.evidence });
      if (file) {
        await bucket.delete(file._id);
        console.log(`🗑️ Deleted GridFS file: ${activity.evidence}`);
      }
    }

    const result = await db.collection('activities').deleteOne({
      _id: new ObjectId(req.params.id)
    });

    res.json({ success: result.deletedCount > 0 });
  } catch (error) {
    console.error('❌ Failed to delete activity or evidence:', error);
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

// Student routes
app.get('/api/student-info/:id', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const student = await db.collection('users').findOne(
      { _id: new ObjectId(req.params.id) },
      { projection: { password: 0 } }
    );
    
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch student info' });
  }
});

// Submission routes
app.get('/submissions', async (req, res) => {
  try {
    const db = await connectToMongoDB2();
    const submissions = await db.collection('submissions').find().toArray();
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

app.delete('/submissions/:id', async (req, res) => {
  try {
    const db = await connectToMongoDB2();
    const id = req.params.id;
    const result = await db.collection('submissions').deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete submission' });
  }
});

app.post('/submissions/approve/:id', async (req, res) => {
  try {
    const db = await connectToMongoDB2();
    const id = req.params.id;
    const original = await db.collection('submit').findOne({ _id: new ObjectId(id) });
    if (!original) return res.status(404).json({ success: false, message: 'Submission not found' });

    const approved = { ...original, medal: req.body.medal, approvedAt: new Date() };
    await db.collection('awarded').insertOne(approved);
    await db.collection('submit').deleteOne({ _id: new ObjectId(id) });

    res.json({ success: true, message: 'Approved and moved to awarded.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/approve-submission', async (req, res) => {
  const { submission, medal } = req.body;
  if (!submission || !medal) return res.status(400).json({ success: false, message: 'Submission and medal are required' });

  try {
    const source = await connectToMongoDB2();
    const dest = await connectToMongoDB3();
    const approvedSubmission = { ...submission, medal, approvedAt: new Date() };

    await dest.collection('approved_submissions').insertOne(approvedSubmission);
    await source.collection('submit').deleteOne({ _id: new ObjectId(submission._id) });

    res.status(200).json({ success: true, message: 'Submission approved and transferred' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error during approval' });
  }
});

// Admin routes
app.get('/api/approved-submissions', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const submissions = await db.collection('approved_submissions')
      .find()
      .sort({ points: -1, approvedAt: -1 }) // Highest points first, then newest first
      .toArray();
      
    res.json(submissions);
  } catch (err) {
    console.error('Error fetching approved submissions:', err);
    res.status(500).json({ error: 'Failed to fetch award data' });
  }
});
app.get('/awards', async (req, res) => {
  try {
    const db = await connectToMongoDB3();
    const data = await db.collection('approved_submissions').find().toArray();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch awards' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const db = await connectToStudentAccountsDB();
    const users = await db.collection('users').find({}, { projection: { password: 0 } }).toArray();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PUT /api/users/:id/active
app.put('/api/users/:id/active', async (req, res) => {
  try {
    const db = await connectToStudentAccountsDB();
    const userId = new ObjectId(req.params.id);
    const { active } = req.body;                // expects { active: true|false }

    const result = await db.collection('users').updateOne(
      { _id: userId },
      { $set: { active: !!active } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'User not found or already in that state' });
    }
    res.json({ success: true, active: !!active });
  } catch (err) {
    console.error('Error toggling user active:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/programs', async (req, res) => {
  try {
    const db = await connectToStudentAccountsDB();
    const programs = await db.collection('programs').find().toArray();
    res.json(programs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch programs' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const db = await connectToStudentAccountsDB();
    const targetId = req.params.id;

    // Simple authorization: require caller to include their user id and match target
    const callerId = req.headers['x-user-id'];
    if (!callerId || callerId !== targetId) {
      return res.status(403).json({ success: false, message: 'Forbidden: can only edit your own account' });
    }

    const { username, password } = req.body;
    const updateFields = {};

    if (username !== undefined && username !== '') {
      // ensure username uniqueness
      const existing = await db.collection('users').findOne({ username, _id: { $ne: new ObjectId(targetId) } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Username already in use' });
      }
      updateFields.username = username;
    }

    if (password !== undefined && password !== '') {
      const hashed = await bcrypt.hash(password, 10);
      updateFields.password = hashed;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(targetId) },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const updatedUser = await db.collection('users').findOne(
      { _id: new ObjectId(targetId) },
      { projection: { password: 0 } }
    );

    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/programs', async (req, res) => {
  let { school, program, years } = req.body;

  years = parseInt(years); // ✅ Ensure it's a number

  if (!school || !program || isNaN(years))
    return res.status(400).json({ error: 'School, program, and valid years are required' });

  try {
    const db = await connectToStudentAccountsDB();
    const result = await db.collection('programs').insertOne({ school, program, years });
    res.status(201).json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add program' });
  }
});

app.delete('/api/programs/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const db = await connectToStudentAccountsDB();
    const result = await db.collection('programs').deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete program' });
  }
});

app.get('/api/schools-with-users', async (req, res) => {
  try {
    const db = await connectToStudentAccountsDB();
    const users = await db.collection('users').find().toArray();

    const grouped = users.reduce((acc, user) => {
      const school = user.school || 'Unknown';
      if (!acc[school]) acc[school] = [];
      acc[school].push(user);
      return acc;
    }, {});

    res.json(grouped);
  } catch (error) {
    console.error('Failed to group users by school:', error);
    res.status(500).json({ error: 'Failed to fetch grouped users' });
  }
});

// Additional routes
app.get('/api/activities/all', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const activities = await db.collection('activities').find().toArray();
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch all activities' });
  }
});

app.get('/api/activities/pending', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const pendingActivities = await db.collection('activities').find({ status: 'pending' }).toArray();
    res.json(pendingActivities);
  } catch (error) {
    console.error('Failed to fetch pending activities:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/total-points/:studentId', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const studentId = new ObjectId(req.params.studentId);

    const aggregation = await db.collection('activities').aggregate([
      { $match: { studentId } },
      { $group: { _id: "$category", totalPoints: { $sum: "$points" } } }
    ]).toArray();

    const result = {};
    aggregation.forEach(item => {
      result[item._id] = item.totalPoints;
    });

    res.json({ success: true, totals: result });
  } catch (error) {
    console.error("Error calculating total points:", error);
    res.status(500).json({ success: false, message: 'Failed to calculate totals' });
  }
});

app.get('/api/forms/:category', async (req, res) => {
  const category = req.params.category;

  try {
    const db = await connectToMongoDB();
    const form = await db.collection('forms').findOne({ categoryKey: category });

    if (!form) {
      console.warn(`⚠️ Form not found for category: ${category}`);
      return res.status(404).json({ success: false, message: 'Form not found' });
    }

    res.json({ success: true, form });
  } catch (err) {
    console.error('Error fetching form template:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/activities', async (req, res) => {
  try {
    const db = await connectToMongoDB();

    const activities = await db.collection('activities').aggregate([
      {
        $match: {
          status: 'Not Submitted'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student'
        }
      },
      {
        $unwind: {
          path: '$student',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          studentId: 1,
          studentName: '$student.name',
          category: 1,
          activity: 1,
          venue: 1,
          date: 1,
          points: 1,
          status: 1,
          createdAt: 1
        }
      }
    ]).toArray();

    res.json(activities);
  } catch (err) {
    console.error('Error fetching activities with student names:', err);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

app.put('/api/activities/:id/submit', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const activityId = new ObjectId(req.params.id);
    const { raterId } = req.body;

    const update = {
      $set: {
        status: 'Submitted',
        updatedAt: new Date()
      }
    };

    // Only set recipientId if raterId is provided and valid
    if (raterId && ObjectId.isValid(raterId)) {
      update.$set.recipientId = new ObjectId(raterId);
    }

    const result = await db.collection('activities').updateOne(
      { _id: activityId },
      update
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'Activity not found or already submitted' });
    }

    res.json({ success: true, message: 'Activity marked as Submitted' });
  } catch (err) {
    console.error('Failed to mark activity as submitted:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/activities/:id/mark-not-submitted', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const id = new ObjectId(req.params.id);

    const result = await db.collection('activities').updateOne(
      { _id: id },
      { $set: { status: 'Not Submitted', updatedAt: new Date() } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'Activity not found or already not submitted' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error marking activity as not submitted:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/notifications', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const { studentId, activityId, message, senderId, role, recipientId } = req.body;

    // ===== 1. VALIDATION =====
    // Check required fields
    const requiredFields = { studentId, activityId, message, senderId, role, recipientId };
    for (const [field, value] of Object.entries(requiredFields)) {
      if (!value) {
        return res.status(400).json({ 
          success: false, 
          message: `Missing required field: ${field}` 
        });
      }
    }

    // Validate ID formats
    const isValidId = (id) => ObjectId.isValid(id) && String(new ObjectId(id)) === id;
    const idsToCheck = { studentId, senderId, recipientId };
    for (const [field, id] of Object.entries(idsToCheck)) {
      if (!isValidId(id)) {
        return res.status(400).json({ 
          success: false, 
          message: `Invalid ID format for ${field}: ${id}` 
        });
      }
    }

    // ===== 2. ACTIVITY ID HANDLING =====
    // Support both composite IDs (685d2b606708e4e82fa3acda_co-curricular) and plain ObjectIds
    let activityIdToUse;
    if (activityId.includes('_')) {
      const [realActivityId] = activityId.split('_');
      if (!isValidId(realActivityId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid composite activity ID format' 
        });
      }
      activityIdToUse = realActivityId;
    } else {
      activityIdToUse = activityId;
    }

    // ===== 3. CREATE NOTIFICATION =====
    const notification = {
      studentId: new ObjectId(studentId),
      activityId: new ObjectId(activityIdToUse),
      recipientId: new ObjectId(recipientId),
      senderId: new ObjectId(senderId),
      message,
      type: role === 'rater' ? 'request' : 'clarification', // Distinguish request vs clarification
      role,
      createdAt: new Date(),
      read: false
    };

    console.log('[Notification] Inserting:', notification); // Debug log

    // ===== 4. SAVE TO DATABASE =====
    const result = await db.collection('notifications').insertOne(notification);
      // ⭐ REVERT STATUS FOR VALIDATOR CLARIFICATIONS
      if (role === 'validator') {
        await db.collection('activities').updateOne(
          { _id: new ObjectId(activityIdToUse) },
          { $set: { status: 'Not Submitted', updatedAt: new Date() } }
        );
        console.log(`Status reverted for activity ${activityIdToUse}`);
      }
    res.json({ 
      success: true,
      notificationId: result.insertedId 
    });

  } catch (err) {
    console.error('❌ Notification error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process notification',
      error: err.message 
    });
  }
});

// PATCH /api/activities/:id/status
app.patch('/api/activities/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid activity ID' });
    }

    const db = await connectToMongoDB();

    const result = await db.collection('activities').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'Activity not found or unchanged' });
    }

    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    console.error('Error updating activity status:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

app.delete('/api/notifications/:id', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const result = await db.collection('notifications').deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/notifications/:id', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const recipientId = req.params.id;

    const notifications = await db.collection('notifications')
      .find({ recipientId: new ObjectId(recipientId) })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(notifications);
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get('/api/debug/statuses', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const statuses = await db.collection('activities').distinct('status');
    res.json({ success: true, statuses });
  } catch (error) {
    console.error('Error fetching distinct status values:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch status values' });
  }
});

// Form management endpoints
app.get('/api/forms', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const forms = await db.collection('forms').find().toArray();
    res.json(forms);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

app.put('/api/forms/:id', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const { fields } = req.body;                  // only pull out the fields array
    const result = await db.collection('forms').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { fields } }                        // explicitly set just fields
    );
    return res.json({ success: result.modifiedCount > 0 });
  } catch (err) {
    console.error('Failed to update form:', err);
    return res.status(500).json({ error: 'Failed to update form' });
  }
});



// ========== ERROR HANDLING MIDDLEWARE ========== //
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        success: false, 
        message: `Unexpected field: ${err.field}. Only 'evidence' file uploads are allowed.`
      });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
});

// ========== STATIC FILE SERVING ========== //
app.use(express.static(path.join(__dirname, 'public')));
app.use('/dashboard', express.static(path.join(__dirname, 'dashboard')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/validator', express.static(path.join(__dirname, 'validator')));
app.use('/rater', express.static(path.join(__dirname, 'rater')));


app.get('/api/current-user', async (req, res) => {
  try {
    const userId = req.headers['x-user-id']; // simulate session

    if (!userId) {
      return res.status(401).json({ error: "Missing user ID" });
    }

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("Error getting current user:", err);
    res.status(500).json({ error: "Server error" });
  }
});       

app.get('/api/users/:id', async (req, res) => {
  try {
    const db = await connectToStudentAccountsDB();
    const user = await db.collection('users')
      .findOne({ _id: new ObjectId(req.params.id) }, { projection: { password: 0 } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Error fetching user by ID:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/awards', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const awards = await db.collection('submissions')
      .find({ medal: { $exists: true, $ne: "" } })
      .toArray();
    res.json(awards);
  } catch (error) {
    console.error('Error fetching awards:', error);
    res.status(500).json({ error: 'Failed to fetch awards' });
  }
});


// ========== SERVER START ========== //
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});