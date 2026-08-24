const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;
const DATA_DIR = path.join(__dirname, 'data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Wolaita2026!ChangeMe';

function requireAdmin(req, res, next) {
    const header = req.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
        const decoded = Buffer.from(encoded, 'base64').toString('utf8');
        const idx = decoded.indexOf(':');
        const user = idx === -1 ? decoded : decoded.slice(0, idx);
        const pass = idx === -1 ? '' : decoded.slice(idx + 1);
        if (user === ADMIN_USER && pass === ADMIN_PASSWORD) {
            return next();
        }
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin", charset="UTF-8"');
    res.status(401).send('Unauthorized');
}

function readBookings() {
    if (!fs.existsSync(BOOKINGS_FILE)) return [];
    const data = fs.readFileSync(BOOKINGS_FILE, 'utf8');
    return JSON.parse(data);
}

function writeBookings(bookings) {
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
}

// Serve static files (admin page protected)
app.use('/admin.html', requireAdmin);
app.use(express.static(__dirname));

// Submit a booking
app.post('/api/booking', (req, res) => {
    const { name, email, phone, startDate, endDate, groupSize, interests, message } = req.body;
    if (!name || !email || !startDate) {
        return res.status(400).json({ error: 'Name, email, and start date are required.' });
    }
    const bookings = readBookings();
    const booking = {
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
    bookings.push(booking);
    writeBookings(bookings);
    res.json({ success: true, id: booking.id });
});

// Get all bookings (admin)
app.get('/api/bookings', requireAdmin, (req, res) => {
    res.json(readBookings());
});

// Update booking status
app.put('/api/bookings/:id/status', requireAdmin, (req, res) => {
    const { status } = req.body;
    const bookings = readBookings();
    const idx = bookings.findIndex(b => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    bookings[idx].status = status;
    writeBookings(bookings);
    res.json({ success: true });
});

// Delete a booking
app.delete('/api/bookings/:id', requireAdmin, (req, res) => {
    let bookings = readBookings();
    bookings = bookings.filter(b => b.id !== req.params.id);
    writeBookings(bookings);
    res.json({ success: true });
});

// Fallback: serve index.html
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
});
