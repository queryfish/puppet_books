const mongoose = require('mongoose');

let crawlerConfigSchema = new mongoose.Schema({
    cursor: Number,
    index: Number,
    minCursor: Number,
    workerState: Number,
    crawlerCode: Number,
    reviverPid: Number,
    workerName: String
});

let crawlerConfig = mongoose.model('crawlerConfig', crawlerConfigSchema);
module.exports = crawlerConfig;
