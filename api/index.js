const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const app = express();

// Cấu hình Cloudinary từ biến môi trường
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cấu hình Multer với memory storage
const storage = multer.memoryStorage();

// File filter: Chỉ cho phép file PNG
const fileFilter = (req, file, cb) => {
  if (file.mimetype === "image/png") {
    cb(null, true);
  } else {
    cb(new Error("Chỉ chấp nhận file ảnh PNG!"), false);
  }
};

// Khởi tạo multer với các quy định
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1 * 1024 * 1024, // Giới hạn 1MB
  },
});

// Hàm upload lên Cloudinary
function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "png-uploads",
        resource_type: "image",
        format: "png",
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

// Hàm lấy tất cả ảnh đã upload từ Cloudinary
async function getAllImages() {
  try {
    const result = await cloudinary.search
      .expression("folder:png-uploads")
      .sort_by("created_at", "desc")
      .max_results(50)
      .execute();
    
    return result.resources.map(resource => resource.secure_url);
  } catch (error) {
    console.error("Error fetching images from Cloudinary:", error);
    return [];
  }
}

// Hàm tạo HTML
function generateHTML(error, success, images, successCount = 0) {
  const errorBox = error
    ? `
    <div class="error-box">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        <p>${error}</p>
    </div>
    `
    : "";

  const successBox = success
    ? `
    <div class="success-box">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        <p>Upload thành công ${successCount} ảnh lên Cloudinary!</p>
    </div>
    `
    : "";

  const galleryTitle = images.length > 0 ? `
    <div class="gallery-header">
        <h2>🖼️ Thư viện ảnh (${images.length} ảnh)</h2>
    </div>
  ` : "";

  const imageGallery =
    images.length > 0
      ? `
    <div class="image-gallery">
        ${images
          .map(
            (img, idx) => `
            <div class="image-item">
                <img src="${img}" alt="Uploaded image ${idx + 1}" loading="lazy">
            </div>
        `
          )
          .join("")}
    </div>
    `
      : `
    <div class="empty-gallery">
        <svg viewBox="0 0 24 24" width="48" height="48"><path fill="rgba(255,255,255,0.2)" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
        <p>Chưa có ảnh nào được upload</p>
    </div>
    `;

  return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Upload Ảnh PNG - Cloudinary</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Outfit', sans-serif;
                min-height: 100vh;
                background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #2d1b4e 100%);
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 20px;
            }
            
            .container {
                background: rgba(255, 255, 255, 0.03);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 24px;
                padding: 48px;
                width: 100%;
                max-width: 700px;
                box-shadow: 
                    0 32px 64px rgba(0, 0, 0, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
            }
            
            h1 {
                color: #fff;
                font-size: 2rem;
                font-weight: 600;
                text-align: center;
                margin-bottom: 8px;
                letter-spacing: -0.5px;
            }
            
            .subtitle {
                color: rgba(255, 255, 255, 0.5);
                text-align: center;
                font-size: 0.95rem;
                margin-bottom: 32px;
            }
            
            .badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background: rgba(59, 130, 246, 0.15);
                border: 1px solid rgba(59, 130, 246, 0.3);
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 0.75rem;
                color: #93c5fd;
                margin-bottom: 24px;
            }
            
            .badge svg {
                width: 14px;
                height: 14px;
                fill: currentColor;
            }
            
            .upload-area {
                border: 2px dashed rgba(139, 92, 246, 0.4);
                border-radius: 16px;
                padding: 40px 24px;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
                background: rgba(139, 92, 246, 0.05);
                margin-bottom: 24px;
            }
            
            .upload-area:hover {
                border-color: rgba(139, 92, 246, 0.8);
                background: rgba(139, 92, 246, 0.1);
                transform: translateY(-2px);
            }
            
            .upload-area.dragover {
                border-color: #8b5cf6;
                background: rgba(139, 92, 246, 0.15);
            }
            
            .upload-icon {
                width: 64px;
                height: 64px;
                margin: 0 auto 16px;
                background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
                border-radius: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .upload-icon svg {
                width: 32px;
                height: 32px;
                fill: white;
            }
            
            .upload-text {
                color: #fff;
                font-size: 1.1rem;
                font-weight: 500;
                margin-bottom: 8px;
            }
            
            .upload-hint {
                color: rgba(255, 255, 255, 0.4);
                font-size: 0.85rem;
            }
            
            input[type="file"] {
                display: none;
            }
            
            .file-list {
                margin-bottom: 24px;
            }
            
            .file-item {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 12px;
                margin-bottom: 8px;
                color: rgba(255, 255, 255, 0.8);
                font-size: 0.9rem;
            }
            
            .file-item svg {
                width: 20px;
                height: 20px;
                margin-right: 12px;
                fill: #8b5cf6;
            }
            
            .btn {
                width: 100%;
                padding: 16px 32px;
                background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
                border: none;
                border-radius: 12px;
                color: white;
                font-family: 'Outfit', sans-serif;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 12px 24px rgba(139, 92, 246, 0.4);
            }
            
            .btn:active {
                transform: translateY(0);
            }
            
            .btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }
            
            .error-box {
                background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.1) 100%);
                border: 1px solid rgba(239, 68, 68, 0.3);
                border-radius: 12px;
                padding: 16px 20px;
                margin-bottom: 24px;
                display: flex;
                align-items: center;
            }
            
            .error-box svg {
                width: 24px;
                height: 24px;
                fill: #ef4444;
                margin-right: 12px;
                flex-shrink: 0;
            }
            
            .error-box p {
                color: #fca5a5;
                font-size: 0.95rem;
                line-height: 1.5;
            }
            
            .success-box {
                background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.1) 100%);
                border: 1px solid rgba(34, 197, 94, 0.3);
                border-radius: 12px;
                padding: 16px 20px;
                margin-bottom: 24px;
                display: flex;
                align-items: center;
            }
            
            .success-box svg {
                width: 24px;
                height: 24px;
                fill: #22c55e;
                margin-right: 12px;
                flex-shrink: 0;
            }
            
            .success-box p {
                color: #86efac;
                font-size: 0.95rem;
            }
            
            .gallery-header {
                margin-top: 32px;
                margin-bottom: 16px;
                padding-top: 24px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .gallery-header h2 {
                color: #fff;
                font-size: 1.25rem;
                font-weight: 500;
            }
            
            .image-gallery {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                gap: 12px;
            }
            
            .image-item {
                position: relative;
                border-radius: 12px;
                overflow: hidden;
                aspect-ratio: 1;
                background: rgba(255, 255, 255, 0.05);
            }
            
            .image-item img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: transform 0.3s ease;
            }
            
            .image-item:hover img {
                transform: scale(1.05);
            }
            
            .empty-gallery {
                text-align: center;
                padding: 40px 20px;
                margin-top: 24px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .empty-gallery p {
                color: rgba(255, 255, 255, 0.4);
                margin-top: 12px;
                font-size: 0.9rem;
            }
            
            .rules {
                margin-top: 24px;
                padding: 16px;
                background: rgba(255, 255, 255, 0.02);
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.05);
            }
            
            .rules h3 {
                color: rgba(255, 255, 255, 0.7);
                font-size: 0.85rem;
                font-weight: 500;
                margin-bottom: 8px;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .rules ul {
                list-style: none;
            }
            
            .rules li {
                color: rgba(255, 255, 255, 0.4);
                font-size: 0.85rem;
                padding: 4px 0;
                display: flex;
                align-items: center;
            }
            
            .rules li::before {
                content: "•";
                color: #8b5cf6;
                margin-right: 8px;
            }
            
            .loading {
                display: none;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            
            .loading.show {
                display: flex;
            }
            
            .spinner {
                width: 20px;
                height: 20px;
                border: 2px solid rgba(255,255,255,0.3);
                border-top-color: white;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📸 Upload Ảnh PNG</h1>
            <p class="subtitle">Kéo thả hoặc chọn file để upload</p>
            
            <div style="text-align: center;">
                <span class="badge">
                    <svg viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>
                    Powered by Cloudinary
                </span>
            </div>
            
            ${errorBox}
            ${successBox}
            
            <form action="/api/upload" method="POST" enctype="multipart/form-data" id="uploadForm">
                <div class="upload-area" id="dropZone">
                    <div class="upload-icon">
                        <svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
                    </div>
                    <p class="upload-text">Nhấn để chọn file hoặc kéo thả vào đây</p>
                    <p class="upload-hint">Hỗ trợ nhiều file PNG, tối đa 1MB/file</p>
                </div>
                <input type="file" name="images" id="fileInput" multiple accept=".png,image/png">
                
                <div class="file-list" id="fileList"></div>
                
                <button type="submit" class="btn" id="submitBtn">
                    <span class="btn-text">Upload Ảnh</span>
                    <span class="loading" id="loading">
                        <span class="spinner"></span>
                        Đang upload...
                    </span>
                </button>
            </form>
            
            ${galleryTitle}
            ${imageGallery}
            
            <div class="rules">
                <h3>Quy định upload</h3>
                <ul>
                    <li>Chỉ chấp nhận file ảnh định dạng PNG</li>
                    <li>Kích thước mỗi file tối đa 1MB</li>
                    <li>Có thể chọn nhiều file cùng lúc</li>
                    <li>Ảnh được lưu trữ vĩnh viễn trên Cloudinary</li>
                </ul>
            </div>
        </div>
        
        <script>
            const dropZone = document.getElementById('dropZone');
            const fileInput = document.getElementById('fileInput');
            const fileList = document.getElementById('fileList');
            const uploadForm = document.getElementById('uploadForm');
            const submitBtn = document.getElementById('submitBtn');
            const btnText = document.querySelector('.btn-text');
            const loading = document.getElementById('loading');
            
            // Click để mở file picker
            dropZone.addEventListener('click', () => fileInput.click());
            
            // Drag & Drop
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            });
            
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('dragover');
            });
            
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                fileInput.files = e.dataTransfer.files;
                updateFileList();
            });
            
            // Hiển thị danh sách file đã chọn
            fileInput.addEventListener('change', updateFileList);
            
            function updateFileList() {
                fileList.innerHTML = '';
                const files = fileInput.files;
                
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const size = (file.size / 1024).toFixed(1);
                    const div = document.createElement('div');
                    div.className = 'file-item';
                    div.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>' + file.name + ' (' + size + ' KB)';
                    fileList.appendChild(div);
                }
            }
            
            // Hiển thị loading khi submit
            uploadForm.addEventListener('submit', () => {
                btnText.style.display = 'none';
                loading.classList.add('show');
                submitBtn.disabled = true;
            });
        </script>
    </body>
    </html>
    `;
}

// Route trang chủ - Hiển thị tất cả ảnh đã upload
app.get("/", async (req, res) => {
  const images = await getAllImages();
  res.send(generateHTML("", false, images));
});

app.get("/api", async (req, res) => {
  const images = await getAllImages();
  res.send(generateHTML("", false, images));
});

// Route xử lý upload
app.post("/api/upload", (req, res) => {
  const uploadMultiple = upload.array("images", 10);

  uploadMultiple(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      let errorMessage = "Có lỗi xảy ra khi upload!";

      if (err.code === "LIMIT_FILE_SIZE") {
        errorMessage = "File quá lớn! Kích thước tối đa là 1MB cho mỗi file.";
      } else if (err.code === "LIMIT_FILE_COUNT") {
        errorMessage = "Số lượng file vượt quá giới hạn cho phép!";
      } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
        errorMessage = "Field không hợp lệ!";
      }

      const images = await getAllImages();
      return res.send(generateHTML(errorMessage, false, images));
    } else if (err) {
      const images = await getAllImages();
      return res.send(generateHTML(err.message, false, images));
    }

    if (!req.files || req.files.length === 0) {
      const images = await getAllImages();
      return res.send(
        generateHTML("Vui lòng chọn ít nhất một file ảnh PNG!", false, images)
      );
    }

    try {
      // Upload tất cả ảnh lên Cloudinary
      const uploadPromises = req.files.map((file) =>
        uploadToCloudinary(file.buffer)
      );
      const results = await Promise.all(uploadPromises);
      const uploadCount = results.length;

      // Lấy lại tất cả ảnh từ Cloudinary (bao gồm ảnh vừa upload)
      const allImages = await getAllImages();

      res.send(generateHTML("", true, allImages, uploadCount));
    } catch (uploadError) {
      console.error("Cloudinary upload error:", uploadError);
      const images = await getAllImages();
      res.send(
        generateHTML(
          "Lỗi khi upload lên Cloudinary: " + uploadError.message,
          false,
          images
        )
      );
    }
  });
});

// Export cho Vercel
module.exports = app;
