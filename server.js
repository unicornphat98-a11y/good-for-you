const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ตั้งค่า Cloudinary (ดึงค่าจาก Environment Variables บน Render)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'uploads',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp']
    }
});

const upload = multer({ storage: storage });

// เชื่อมต่อ MongoDB (ดึงค่าจาก Environment Variables บน Render)
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// โครงสร้างฐานข้อมูล
const ImageSchema = new mongoose.Schema({
    title: String,
    description: String,
    imageUrl: String,
    cloudinaryId: String, 
    createdAt: { type: Date, default: Date.now }
});
const ImageModel = mongoose.model('Image', ImageSchema);

// 1. อัปโหลดหลายรูปพร้อมกัน (สูงสุด 5 รูป)
app.post('/upload', upload.array('imageFiles', 5), async (req, res) => {
    try {
        const { title, description } = req.body;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ message: 'กรุณาเลือกรูปภาพอย่างน้อย 1 รูป' });
        }

        const savedImages = [];
        for (const file of files) {
            const newImage = new ImageModel({
                title: title || 'ไม่มีชื่อ',
                description: description || '',
                imageUrl: file.path,
                cloudinaryId: file.filename
            });
            await newImage.save();
            savedImages.push(newImage);
        }

        res.json({ message: `อัปโหลดสำเร็จ ${savedImages.length} รูป!`, data: savedImages });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปโหลด' });
    }
});

// 2. ค้นหา / ดึงข้อมูลทั้งหมด
app.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        let filter = {};
        if (query) {
            filter = {
                $or: [
                    { title: { $regex: query, $options: 'i' } },
                    { description: { $regex: query, $options: 'i' } }
                ]
            };
        }
        const results = await ImageModel.find(filter).sort({ createdAt: -1 });
        res.json(results);
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการค้นหา' });
    }
});

// 3. แก้ไขรายละเอียดรูปภาพ
app.put('/update/:id', async (req, res) => {
    try {
        const { title, description } = req.body;
        await ImageModel.findByIdAndUpdate(req.params.id, { title, description });
        res.json({ message: 'แก้ไขข้อมูลสำเร็จ' });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการแก้ไข' });
    }
});

// 4. ลบรูปภาพ (ลบจากทั้ง MongoDB และ Cloudinary)
app.delete('/delete/:id', async (req, res) => {
    try {
        const image = await ImageModel.findById(req.params.id);
        if (!image) return res.status(404).json({ message: 'ไม่พบรูปภาพ' });

        if (image.cloudinaryId) {
            await cloudinary.uploader.destroy(image.cloudinaryId);
        }

        await ImageModel.findByIdAndDelete(req.params.id);
        res.json({ message: 'ลบรูปภาพสำเร็จ' });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบ' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));