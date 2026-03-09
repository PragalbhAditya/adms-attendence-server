const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Attendance = require('./models/Attendance');
const User = require('./models/User');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/live_attendance')
    .then(() => console.log('✅ MongoDB Connected (ADMS Server)'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));


// ===== ADMS (PUSH PROTOCOL) ENDPOINTS =====

// 1. Initial Handshake & Options (Device calls this when it starts up)
// Must be handled on /iclock/cdata as GET
app.get('/api/iclock/cdata', (req, res) => {
    console.log(`📡 Device Handshake received from SN: ${req.query.SN}`);

    // Send basic config to instruct device to send real-time data
    res.send(
        `GET OPTION FROM: ${req.query.SN}\n` +
        `Stamp=9999\n` +
        `OpStamp=9999\n` +
        `ErrorDelay=60\n` +
        `Delay=10\n` +
        `TransTimes=00:00;14:00\n` +
        `TransInterval=1\n` +
        `TransFlag=1111000000\n` +
        `Realtime=1\n` +
        `Encrypt=0\n`
    );
});

// 2. Data Receiver (Device posts attendance arrays here)
// Need text parser because ADMS sends tab-separated plain text
app.post('/api/iclock/cdata', express.text({ type: '*/*' }), async (req, res) => {
    try {
        const table = req.query.table;
        const rawData = req.body || '';

        console.log(`📥 Received ADMS push data (Table: ${table}):\n${rawData}`);

        if (table === 'ATTLOG') {
            const lines = rawData.trim().split('\n');
            for (const line of lines) {
                if (!line.trim()) continue;

                const parts = line.split(/[\t\s]+/);

                if (parts.length >= 2) {
                    const userId = parts[0].trim();

                    const tabParts = line.split('\t');
                    let actualUserId = userId;
                    let actualDateStr = '';

                    if (tabParts.length >= 2) {
                        actualUserId = tabParts[0].trim();
                        actualDateStr = tabParts[1].trim();
                    } else if (parts.length >= 3) {
                        actualUserId = parts[0].trim();
                        actualDateStr = parts[1] + ' ' + parts[2];
                    }

                    const recordTime = new Date(actualDateStr);

                    if (!actualUserId || isNaN(recordTime.getTime())) continue;

                    const thirtySecondsAgo = new Date(recordTime.getTime() - 30000);
                    const existing = await Attendance.findOne({
                        userId: actualUserId,
                        timestamp: { $gte: thirtySecondsAgo, $lte: recordTime }
                    });

                    if (!existing) {
                        const newLog = new Attendance({
                            userId: actualUserId,
                            timestamp: recordTime,
                            device: req.query.SN || 'ADMS Push',
                            recordId: Math.floor(Math.random() * 1000000).toString()
                        });
                        await newLog.save();
                        console.log(`✨ New ADMS Check-in saved to DB: User ${actualUserId} at ${recordTime.toLocaleTimeString()}`);

                        // Note: If you want real-time updates on the frontend, the ADMS server 
                        // could ping the main API server or share a Redis/Socket connection.
                        // For now, it simply saves to the identical MongoDB collection.
                    }
                }
            }
        }

        // Must reply "OK" so the device deletes the log from its send-queue
        res.send('OK\n');
    } catch (err) {
        console.error('❌ Error processing ADMS data:', err);
        res.status(500).send('ERROR\n');
    }
});

// 3. Command Request Endpoint
app.get('/api/iclock/getrequest', (req, res) => {
    res.send('OK\n');
});

// Health check API under /api
app.get('/api/health', (req, res) => {
    res.json({ status: 'ADMS Server is running', port: PORT });
});


const PORT = process.env.PORT || 8081;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n================================`);
    console.log(`🌐 ADMS Push Server Active`);
    console.log(`📡 Listening for device connections on port: ${PORT}`);
    console.log(`================================\n`);
});
