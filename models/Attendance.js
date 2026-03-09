const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        required: true
    },
    device: {
        type: String,
        default: 'ADMS Push'
    },
    recordId: {
        type: String,
        required: true,
        unique: true
    }
});

module.exports = mongoose.model('Attendance', AttendanceSchema, 'biometric');
