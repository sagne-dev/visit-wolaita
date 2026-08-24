const express = require('express');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 8000;
const DATA_DIR = path.join(__dirname, 'data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const MONGODB_URI = (process.env.MONGODB_URI || '').trim().replace(/^["']+|["']+$/g, '');
const DB_NAME = 'visit_wolaita';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let collection = null;

function readBookingsFile() {
    if (!fs.existsSync(BOOKINGS_FILE)) return [];
    return JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf8'));
}

function writeBookingsFile(bookings) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
}

function buildBooking({ name, email, phone, startDate, endDate, groupSize, interests, message }) {
    if (!name || !email || !startDate) return null;
    return {
        id: Date.now().toString(),
        name,
        email,
        phone: phone || '',
        startDate,
        endDate: endDate || '',
        groupSize: groupSize || '',
        interests: interests || [],
        message: message || '',
        status: 'pending',
        submittedAt: new Date().toISOString()
    };
}

async function getBookings() {
    if (collection) return collection.find({}, { projection: { _id: 0 } }).toArray();
    return readBookingsFile();
}

async function saveBooking(booking) {
    if (collection) {
        await collection.insertOne({ ...booking });
        return booking.id;
    }
    const bookings = readBookingsFile();
    bookings.push(booking);
    writeBookingsFile(bookings);
    return booking.id;
}

async function setBookingStatus(id, status) {
    if (collection) {
        const result = await collection.updateOne({ id }, { $set: { status } });
        return result.matchedCount > 0;
    }
    const bookings = readBookingsFile();
    const idx = bookings.findIndex(b => b.id === id);
    if (idx === -1) return false;
    bookings[idx].status = status;
    writeBookingsFile(bookings);
    return true;
}

async function removeBooking(id) {
    if (collection) {
        await collection.deleteOne({ id });
        return true;
    }
    let bookings = readBookingsFile();
    bookings = bookings.filter(b => b.id !== id);
    writeBookingsFile(bookings);
    return true;
}

// Serve static files
app.use(express.static(__dirname));

// Submit a booking
app.post('/api/booking', async (req, res) => {
    const booking = buildBooking(req.body);
    if (!booking) {
        return res.status(400).json({ error: 'Name, email, and start date are required.' });
    }
    const id = await saveBooking(booking);
    res.json({ success: true, id });
});

// Get all bookings (admin)
app.get('/api/bookings', async (req, res) => {
    res.json(await getBookings());
});

// Update booking status
app.put('/api/bookings/:id/status', async (req, res) => {
    const ok = await setBookingStatus(req.params.id, req.body.status);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
});

// Delete a booking
app.delete('/api/bookings/:id', async (req, res) => {
    await removeBooking(req.params.id);
    res.json({ success: true });
});

// Fallback: serve index.html
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

(async () => {
    if (MONGODB_URI) {
        try {
            const client = new MongoClient(MONGODB_URI);
            await client.connect();
            collection = client.db(DB_NAME).collection('bookings');
            console.log('Connected to MongoDB - bookings stored permanently');
        } catch (err) {
            console.error('MongoDB connection failed, falling back to file storage:', err.message);
        }
    } else {
        console.warn('MONGODB_URI not set - using temporary file storage');
    }
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running at http://0.0.0.0:${PORT}`);
    });
})();
