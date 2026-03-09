module.exports = {
    apps: [
        {
            name: "adms-receiver",
            script: "index.js",
            env: {
                NODE_ENV: "production",
                PORT: 8081,
                MONGO_URI: process.env.MONGO_URI || "mongodb://Xeno:Xenophine%401910@72.62.242.230:27017/dishanucleus"
            }
        }
    ]
}
