const fs = require('fs');
const path = require('path');

const source = "C:\\Users\\Erickson Guhilde\\.gemini\\antigravity\\brain\\35cd2701-8861-4314-bd59-c1423c080065\\media__1778387468104.png";
const targets = [
    path.join(__dirname, "assets", "icon.png"),
    path.join(__dirname, "assets", "adaptive-icon.png"),
    path.join(__dirname, "assets", "favicon.png")
];

targets.forEach(target => {
    try {
        fs.copyFileSync(source, target);
        console.log(`Copied to ${target}`);
    } catch (err) {
        console.error(`Failed to copy to ${target}: ${err.message}`);
    }
});
