require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const port = process.env.PORT || 3000;

// ตั้งค่า Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ตั้งค่าการเก็บรูปภาพขึ้น Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'polist_uploads',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp']
    }
});
const upload = multer({ storage: storage });

// เชื่อมต่อ MongoDB Online
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB Online!'))
    .catch(err => console.error('MongoDB connection error:', err));

// สร้างโครงสร้างข้อมูล (Schema)
const ItemSchema = new mongoose.Schema({
    title: String,
    description: String,
    imageUrl: String,
    createdAt: { type: Date, default: Date.now }
});
const Item = mongoose.model('Item', ItemSchema);

app.use(express.static('public'));

// เส้นทางสำหรับหน้าแรก (แก้ปัญหา Not Found)
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// API สำหรับรับข้อมูลและอัปโหลดรูปขึ้น Cloud
app.post('/upload', upload.single('imageFile'), async (req, res) => {
    try {
        const newItem = new Item({
            title: req.body.title,
            description: req.body.description,
            imageUrl: req.file.path // ลิงก์รูปจาก Cloudinary
        });

        await newItem.save();
        res.json({ message: 'อัปโหลดสำเร็จ!', data: newItem });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปโหลด' });
    }
});

// API สำหรับค้นหาข้อมูลจาก MongoDB
app.get('/search', async (req, res) => {
    try {
        const keyword = req.query.q || '';
        const results = await Item.find({
            $or: [
                { title: { $regex: keyword, $options: 'i' } },
                { description: { $regex: keyword, $options: 'i' } }
            ]
        });
        res.json(results);
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการค้นหา' });
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});