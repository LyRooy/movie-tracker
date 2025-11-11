const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { db, auth, storage } = require('./firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting configuration
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login/register attempts per windowMs
    message: 'Too many authentication attempts, please try again later.'
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(generalLimiter);

// Serve static files only from specific directories (not the root)
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Serve HTML files explicitly
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// File upload configuration
const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, process.env.UPLOAD_DIR || 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: multerStorage });

// JWT middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.sendStatus(401);
    }

    jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Helper function to convert Firestore timestamp to date
const convertTimestamp = (timestamp) => {
    if (!timestamp) return null;
    return timestamp.toDate ? timestamp.toDate() : timestamp;
};

// Routes

// Authentication routes
app.post('/api/register', authLimiter, async (req, res) => {
    try {
        const { nickname, email, password, role = 'user' } = req.body;
        
        // Check if user exists
        const usersSnapshot = await db.collection('Users')
            .where('email', '==', email)
            .get();
        
        if (!usersSnapshot.empty) {
            return res.status(400).json({ message: 'User already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user in Firestore
        const userRef = await db.collection('Users').add({
            nickname: nickname,
            email: email,
            password_hash: hashedPassword,
            avatar_url: null,
            description: null,
            role: role,
            theme_preference: 'light',
            created_at: new Date()
        });
        
        const token = jwt.sign(
            { userId: userRef.id, nickname },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '24h' }
        );
        
        res.status(201).json({
            message: 'User created successfully',
            token,
            user: { id: userRef.id, nickname, email }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const usersSnapshot = await db.collection('Users')
            .where('email', '==', email)
            .get();
        
        if (usersSnapshot.empty) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const userDoc = usersSnapshot.docs[0];
        const user = userDoc.data();
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { userId: userDoc.id, nickname: user.nickname },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '24h' }
        );
        
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: userDoc.id,
                nickname: user.nickname,
                email: user.email,
                avatar_url: user.avatar_url,
                theme_preference: user.theme_preference
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// User routes
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const userDoc = await db.collection('Users').doc(req.user.userId).get();
        
        if (!userDoc.exists) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const userData = userDoc.data();
        res.json({
            id: userDoc.id,
            nickname: userData.nickname,
            email: userData.email,
            avatar_url: userData.avatar_url,
            description: userData.description,
            role: userData.role,
            theme_preference: userData.theme_preference
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const { nickname, description, theme_preference } = req.body;
        
        await db.collection('Users').doc(req.user.userId).update({
            nickname: nickname,
            description: description,
            theme_preference: theme_preference,
            updated_at: new Date()
        });
        
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Upload avatar
app.post('/api/user/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        
        const avatarUrl = `/uploads/${req.file.filename}`;
        
        await db.collection('Users').doc(req.user.userId).update({
            avatar_url: avatarUrl,
            updated_at: new Date()
        });
        
        res.json({ 
            message: 'Avatar uploaded successfully',
            avatar_url: avatarUrl
        });
    } catch (error) {
        console.error('Avatar upload error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Movies routes
app.get('/api/movies/search', async (req, res) => {
    try {
        const { query, type, genre, year } = req.query;
        
        let moviesQuery = db.collection('Movies');
        
        if (type) {
            moviesQuery = moviesQuery.where('type', '==', type);
        }
        
        const moviesSnapshot = await moviesQuery.get();
        let movies = moviesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Client-side filtering for partial matches
        if (query) {
            movies = movies.filter(movie => 
                movie.title.toLowerCase().includes(query.toLowerCase())
            );
        }
        
        if (genre) {
            movies = movies.filter(movie => 
                movie.genre && movie.genre.toLowerCase().includes(genre.toLowerCase())
            );
        }
        
        if (year) {
            movies = movies.filter(movie => {
                const releaseDate = convertTimestamp(movie.release_date);
                return releaseDate && releaseDate.getFullYear().toString() === year;
            });
        }
        
        res.json(movies.slice(0, 50));
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/movies/:id', async (req, res) => {
    try {
        const movieDoc = await db.collection('Movies').doc(req.params.id).get();
        
        if (!movieDoc.exists) {
            return res.status(404).json({ message: 'Movie not found' });
        }
        
        res.json({
            id: movieDoc.id,
            ...movieDoc.data()
        });
    } catch (error) {
        console.error('Get movie error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/movies', authenticateToken, async (req, res) => {
    try {
        const { title, type, genre, release_date, description, poster_url, trailer_url } = req.body;
        
        const movieRef = await db.collection('Movies').add({
            title: title,
            type: type,
            genre: genre,
            release_date: release_date ? new Date(release_date) : null,
            description: description,
            poster_url: poster_url,
            trailer_url: trailer_url,
            created_at: new Date()
        });
        
        res.status(201).json({
            message: 'Movie added successfully',
            id: movieRef.id
        });
    } catch (error) {
        console.error('Add movie error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Watched routes
app.get('/api/watched', authenticateToken, async (req, res) => {
    try {
        const watchedSnapshot = await db.collection('Watched')
            .where('user_id', '==', req.user.userId)
            .get();
        
        const watched = [];
        for (const doc of watchedSnapshot.docs) {
            const watchedData = doc.data();
            const movieDoc = await db.collection('Movies').doc(watchedData.movie_id).get();
            
            watched.push({
                id: doc.id,
                ...watchedData,
                watched_date: convertTimestamp(watchedData.watched_date),
                movie: movieDoc.exists ? { id: movieDoc.id, ...movieDoc.data() } : null
            });
        }
        
        res.json(watched);
    } catch (error) {
        console.error('Get watched error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/watched', authenticateToken, async (req, res) => {
    try {
        const { movie_id, watched_date } = req.body;
        
        const watchedRef = await db.collection('Watched').add({
            user_id: req.user.userId,
            movie_id: movie_id,
            watched_date: watched_date ? new Date(watched_date) : new Date()
        });
        
        res.status(201).json({
            message: 'Added to watched list',
            id: watchedRef.id
        });
    } catch (error) {
        console.error('Add watched error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/watched/:id', authenticateToken, async (req, res) => {
    try {
        const watchedDoc = await db.collection('Watched').doc(req.params.id).get();
        
        if (!watchedDoc.exists) {
            return res.status(404).json({ message: 'Watched entry not found' });
        }
        
        const watchedData = watchedDoc.data();
        if (watchedData.user_id !== req.user.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        
        await db.collection('Watched').doc(req.params.id).delete();
        
        res.json({ message: 'Removed from watched list' });
    } catch (error) {
        console.error('Delete watched error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Reviews routes
app.get('/api/reviews/movie/:movieId', async (req, res) => {
    try {
        const reviewsSnapshot = await db.collection('Reviews')
            .where('movie_id', '==', req.params.movieId)
            .get();
        
        const reviews = [];
        for (const doc of reviewsSnapshot.docs) {
            const reviewData = doc.data();
            const userDoc = await db.collection('Users').doc(reviewData.user_id).get();
            
            reviews.push({
                id: doc.id,
                ...reviewData,
                created_at: convertTimestamp(reviewData.created_at),
                user: userDoc.exists ? {
                    id: userDoc.id,
                    nickname: userDoc.data().nickname,
                    avatar_url: userDoc.data().avatar_url
                } : null
            });
        }
        
        res.json(reviews);
    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/reviews', authenticateToken, async (req, res) => {
    try {
        const { movie_id, content, rating } = req.body;
        
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5' });
        }
        
        const reviewRef = await db.collection('Reviews').add({
            user_id: req.user.userId,
            movie_id: movie_id,
            content: content || null,
            rating: rating,
            created_at: new Date()
        });
        
        res.status(201).json({
            message: 'Review added successfully',
            id: reviewRef.id
        });
    } catch (error) {
        console.error('Add review error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.put('/api/reviews/:id', authenticateToken, async (req, res) => {
    try {
        const { content, rating } = req.body;
        const reviewDoc = await db.collection('Reviews').doc(req.params.id).get();
        
        if (!reviewDoc.exists) {
            return res.status(404).json({ message: 'Review not found' });
        }
        
        const reviewData = reviewDoc.data();
        if (reviewData.user_id !== req.user.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        
        if (rating && (rating < 1 || rating > 5)) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5' });
        }
        
        await db.collection('Reviews').doc(req.params.id).update({
            content: content !== undefined ? content : reviewData.content,
            rating: rating || reviewData.rating,
            updated_at: new Date()
        });
        
        res.json({ message: 'Review updated successfully' });
    } catch (error) {
        console.error('Update review error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/reviews/:id', authenticateToken, async (req, res) => {
    try {
        const reviewDoc = await db.collection('Reviews').doc(req.params.id).get();
        
        if (!reviewDoc.exists) {
            return res.status(404).json({ message: 'Review not found' });
        }
        
        const reviewData = reviewDoc.data();
        if (reviewData.user_id !== req.user.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        
        await db.collection('Reviews').doc(req.params.id).delete();
        
        res.json({ message: 'Review deleted successfully' });
    } catch (error) {
        console.error('Delete review error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Challenges routes
app.get('/api/challenges', async (req, res) => {
    try {
        const { active } = req.query;
        let challengesQuery = db.collection('Challenges');
        
        if (active === 'true') {
            const now = new Date();
            challengesQuery = challengesQuery
                .where('start_date', '<=', now)
                .where('end_date', '>=', now);
        }
        
        const challengesSnapshot = await challengesQuery.get();
        const challenges = challengesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            start_date: convertTimestamp(doc.data().start_date),
            end_date: convertTimestamp(doc.data().end_date)
        }));
        
        res.json(challenges);
    } catch (error) {
        console.error('Get challenges error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/challenges/:id', async (req, res) => {
    try {
        const challengeDoc = await db.collection('Challenges').doc(req.params.id).get();
        
        if (!challengeDoc.exists) {
            return res.status(404).json({ message: 'Challenge not found' });
        }
        
        const challengeData = challengeDoc.data();
        res.json({
            id: challengeDoc.id,
            ...challengeData,
            start_date: convertTimestamp(challengeData.start_date),
            end_date: convertTimestamp(challengeData.end_date)
        });
    } catch (error) {
        console.error('Get challenge error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/challenges', authenticateToken, async (req, res) => {
    try {
        const { title, description, type, criteria_value, target_count, start_date, end_date, badge_id } = req.body;
        
        const challengeRef = await db.collection('Challenges').add({
            title: title,
            description: description,
            type: type,
            criteria_value: criteria_value,
            target_count: target_count,
            start_date: start_date ? new Date(start_date) : new Date(),
            end_date: end_date ? new Date(end_date) : null,
            badge_id: badge_id || null,
            created_at: new Date()
        });
        
        res.status(201).json({
            message: 'Challenge created successfully',
            id: challengeRef.id
        });
    } catch (error) {
        console.error('Create challenge error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Challenge Participants routes
app.post('/api/challenges/:id/join', authenticateToken, async (req, res) => {
    try {
        // Check if already participating
        const existingSnapshot = await db.collection('Challenge_Participants')
            .where('challenge_id', '==', req.params.id)
            .where('user_id', '==', req.user.userId)
            .get();
        
        if (!existingSnapshot.empty) {
            return res.status(400).json({ message: 'Already participating in this challenge' });
        }
        
        const participantRef = await db.collection('Challenge_Participants').add({
            challenge_id: req.params.id,
            user_id: req.user.userId,
            joined_at: new Date(),
            completed_at: null,
            progress: 0
        });
        
        res.status(201).json({
            message: 'Joined challenge successfully',
            id: participantRef.id
        });
    } catch (error) {
        console.error('Join challenge error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/challenges/:id/participants', async (req, res) => {
    try {
        const participantsSnapshot = await db.collection('Challenge_Participants')
            .where('challenge_id', '==', req.params.id)
            .get();
        
        const participants = [];
        for (const doc of participantsSnapshot.docs) {
            const participantData = doc.data();
            const userDoc = await db.collection('Users').doc(participantData.user_id).get();
            
            participants.push({
                id: doc.id,
                ...participantData,
                joined_at: convertTimestamp(participantData.joined_at),
                completed_at: convertTimestamp(participantData.completed_at),
                user: userDoc.exists ? {
                    id: userDoc.id,
                    nickname: userDoc.data().nickname,
                    avatar_url: userDoc.data().avatar_url
                } : null
            });
        }
        
        res.json(participants);
    } catch (error) {
        console.error('Get participants error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/user/challenges', authenticateToken, async (req, res) => {
    try {
        const participantsSnapshot = await db.collection('Challenge_Participants')
            .where('user_id', '==', req.user.userId)
            .get();
        
        const challenges = [];
        for (const doc of participantsSnapshot.docs) {
            const participantData = doc.data();
            const challengeDoc = await db.collection('Challenges').doc(participantData.challenge_id).get();
            
            if (challengeDoc.exists) {
                challenges.push({
                    participant_id: doc.id,
                    ...participantData,
                    joined_at: convertTimestamp(participantData.joined_at),
                    completed_at: convertTimestamp(participantData.completed_at),
                    challenge: {
                        id: challengeDoc.id,
                        ...challengeDoc.data(),
                        start_date: convertTimestamp(challengeDoc.data().start_date),
                        end_date: convertTimestamp(challengeDoc.data().end_date)
                    }
                });
            }
        }
        
        res.json(challenges);
    } catch (error) {
        console.error('Get user challenges error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Badges routes
app.get('/api/badges', async (req, res) => {
    try {
        const badgesSnapshot = await db.collection('Badges').get();
        const badges = badgesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        res.json(badges);
    } catch (error) {
        console.error('Get badges error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/user/badges', authenticateToken, async (req, res) => {
    try {
        const userBadgesSnapshot = await db.collection('User_Badges')
            .where('user_id', '==', req.user.userId)
            .get();
        
        const badges = [];
        for (const doc of userBadgesSnapshot.docs) {
            const userBadgeData = doc.data();
            const badgeDoc = await db.collection('Badges').doc(userBadgeData.badge_id).get();
            
            if (badgeDoc.exists) {
                badges.push({
                    id: doc.id,
                    ...userBadgeData,
                    earned_at: convertTimestamp(userBadgeData.earned_at),
                    badge: {
                        id: badgeDoc.id,
                        ...badgeDoc.data()
                    }
                });
            }
        }
        
        res.json(badges);
    } catch (error) {
        console.error('Get user badges error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Friends routes
app.get('/api/friends', authenticateToken, async (req, res) => {
    try {
        const { status } = req.query;
        
        let friendsQuery = db.collection('Friends');
        
        // Get friends where user is either user1 or user2
        const friends1Snapshot = await friendsQuery
            .where('user1_id', '==', req.user.userId)
            .get();
        
        const friends2Snapshot = await friendsQuery
            .where('user2_id', '==', req.user.userId)
            .get();
        
        const allFriends = [...friends1Snapshot.docs, ...friends2Snapshot.docs];
        
        const friends = [];
        for (const doc of allFriends) {
            const friendData = doc.data();
            
            if (status && friendData.status !== status) {
                continue;
            }
            
            const otherUserId = friendData.user1_id === req.user.userId 
                ? friendData.user2_id 
                : friendData.user1_id;
            
            const userDoc = await db.collection('Users').doc(otherUserId).get();
            
            friends.push({
                id: doc.id,
                ...friendData,
                requested_at: convertTimestamp(friendData.requested_at),
                responded_at: convertTimestamp(friendData.responded_at),
                friend: userDoc.exists ? {
                    id: userDoc.id,
                    nickname: userDoc.data().nickname,
                    avatar_url: userDoc.data().avatar_url
                } : null
            });
        }
        
        res.json(friends);
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/friends/request', authenticateToken, async (req, res) => {
    try {
        const { friend_id } = req.body;
        
        if (friend_id === req.user.userId) {
            return res.status(400).json({ message: 'Cannot send friend request to yourself' });
        }
        
        // Check if friendship already exists
        const existingSnapshot = await db.collection('Friends')
            .where('user1_id', 'in', [req.user.userId, friend_id])
            .get();
        
        for (const doc of existingSnapshot.docs) {
            const data = doc.data();
            if ((data.user1_id === req.user.userId && data.user2_id === friend_id) ||
                (data.user1_id === friend_id && data.user2_id === req.user.userId)) {
                return res.status(400).json({ message: 'Friend request already exists' });
            }
        }
        
        const friendRef = await db.collection('Friends').add({
            user1_id: req.user.userId,
            user2_id: friend_id,
            status: 'pending',
            requested_at: new Date(),
            responded_at: null
        });
        
        res.status(201).json({
            message: 'Friend request sent',
            id: friendRef.id
        });
    } catch (error) {
        console.error('Send friend request error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.put('/api/friends/:id/respond', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body; // 'accepted', 'rejected', or 'blocked'
        
        if (!['accepted', 'rejected', 'blocked'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }
        
        const friendDoc = await db.collection('Friends').doc(req.params.id).get();
        
        if (!friendDoc.exists) {
            return res.status(404).json({ message: 'Friend request not found' });
        }
        
        const friendData = friendDoc.data();
        
        // Check if the current user is the recipient of the request
        if (friendData.user2_id !== req.user.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        
        await db.collection('Friends').doc(req.params.id).update({
            status: status,
            responded_at: new Date()
        });
        
        res.json({ message: `Friend request ${status}` });
    } catch (error) {
        console.error('Respond to friend request error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/friends/:id', authenticateToken, async (req, res) => {
    try {
        const friendDoc = await db.collection('Friends').doc(req.params.id).get();
        
        if (!friendDoc.exists) {
            return res.status(404).json({ message: 'Friendship not found' });
        }
        
        const friendData = friendDoc.data();
        
        // Check if user is part of this friendship
        if (friendData.user1_id !== req.user.userId && friendData.user2_id !== req.user.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        
        await db.collection('Friends').doc(req.params.id).delete();
        
        res.json({ message: 'Friendship removed' });
    } catch (error) {
        console.error('Delete friendship error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Statistics route
app.get('/api/user/statistics', authenticateToken, async (req, res) => {
    try {
        // Get watched items
        const watchedSnapshot = await db.collection('Watched')
            .where('user_id', '==', req.user.userId)
            .get();
        
        const movieIds = watchedSnapshot.docs.map(doc => doc.data().movie_id);
        
        let movies = [];
        if (movieIds.length > 0) {
            // Get movies in batches (Firestore 'in' query limit is 10)
            for (let i = 0; i < movieIds.length; i += 10) {
                const batch = movieIds.slice(i, i + 10);
                const moviesSnapshot = await db.collection('Movies')
                    .where(admin.firestore.FieldPath.documentId(), 'in', batch)
                    .get();
                
                movies = movies.concat(moviesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })));
            }
        }
        
        // Get reviews
        const reviewsSnapshot = await db.collection('Reviews')
            .where('user_id', '==', req.user.userId)
            .get();
        
        const reviews = reviewsSnapshot.docs.map(doc => doc.data());
        
        // Calculate statistics
        const stats = {
            total_watched: watchedSnapshot.size,
            movies_count: movies.filter(m => m.type === 'movie').length,
            series_count: movies.filter(m => m.type === 'series').length,
            total_reviews: reviewsSnapshot.size,
            average_rating: reviews.length > 0 
                ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
                : 0,
            genres: {}
        };
        
        // Count by genre
        movies.forEach(movie => {
            if (movie.genre) {
                stats.genres[movie.genre] = (stats.genres[movie.genre] || 0) + 1;
            }
        });
        
        res.json(stats);
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Make sure to set up your Firebase credentials in .env file`);
});
