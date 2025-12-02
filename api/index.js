const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const app = express();

// Middleware để parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Hàm upload lên Cloudinary với eager transformation cho thumbnail
function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "png-uploads",
        resource_type: "image",
        format: "png",
        eager: [{ width: 300, height: 300, crop: "fill", quality: "auto" }],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

// Hàm xóa ảnh từ Cloudinary
function deleteFromCloudinary(publicId) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

// Hàm lấy tất cả ảnh đã upload từ Cloudinary (bao gồm public_id)
async function getAllImages() {
  try {
    const result = await cloudinary.search
      .expression("folder:png-uploads")
      .sort_by("created_at", "desc")
      .max_results(50)
      .execute();

    return result.resources.map((resource) => {
      // Tạo thumbnail URL với Cloudinary transformation
      const thumbUrl = resource.secure_url.replace(
        "/upload/",
        "/upload/c_fill,w_300,h_300,q_auto,f_auto/"
      );
      return {
        url: resource.secure_url,
        thumbUrl: thumbUrl,
        publicId: resource.public_id,
      };
    });
  } catch (error) {
    console.error("Error fetching images from Cloudinary:", error);
    return [];
  }
}

// Hàm tạo HTML
function generateHTML(
  error,
  success,
  images,
  successCount = 0,
  deleteSuccess = false
) {
  const errorBox = error
    ? `
    <div class="error-box" id="errorBox">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        <p>${error}</p>
    </div>
    `
    : "";

  const successBox = success
    ? `
    <div class="success-box" id="successBox">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        <p>Upload thành công ${successCount} ảnh lên Cloudinary!</p>
    </div>
    `
    : "";

  const deleteSuccessBox = deleteSuccess
    ? `
    <div class="success-box" id="deleteSuccessBox">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        <p>Đã xóa ảnh thành công!</p>
    </div>
    `
    : "";

  const galleryTitle =
    images.length > 0
      ? `
    <div class="gallery-header" id="galleryHeader">
        <h2>🖼️ Thư viện ảnh (<span id="imageCount">${images.length}</span> ảnh)</h2>
        <p class="gallery-hint">Hover vào ảnh để xem các tùy chọn</p>
    </div>
  `
      : "";

  const imageGallery =
    images.length > 0
      ? `
    <div class="image-gallery" id="imageGallery">
        ${images
          .map(
            (img, idx) => `
            <div class="image-item" data-id="${img.publicId}">
                <img src="${img.thumbUrl}" data-full="${
              img.url
            }" alt="Uploaded image ${idx + 1}" loading="lazy">
                <div class="image-overlay">
                    <a href="${img.url}" download="image-${
              idx + 1
            }.png" class="action-btn download-btn" title="Tải xuống" target="_blank">
                        <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                    </a>
                    <button class="action-btn delete-btn" onclick="deleteImage('${
                      img.publicId
                    }')" title="Xóa ảnh">
                        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                </div>
            </div>
        `
          )
          .join("")}
    </div>
    `
      : `
    <div class="empty-gallery" id="emptyGallery">
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
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
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
            
            .upload-area.uploading {
                pointer-events: none;
                opacity: 0.7;
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
                position: relative;
            }
            
            .btn:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 12px 24px rgba(139, 92, 246, 0.4);
            }
            
            .btn:active:not(:disabled) {
                transform: translateY(0);
            }
            
            .btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }
            
            .btn-text {
                transition: opacity 0.2s;
            }
            
            .error-box, .success-box {
                border-radius: 12px;
                padding: 16px 20px;
                margin-bottom: 24px;
                display: flex;
                align-items: center;
                animation: fadeIn 0.3s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .error-box {
                background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.1) 100%);
                border: 1px solid rgba(239, 68, 68, 0.3);
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
            
            .gallery-hint {
                color: rgba(255, 255, 255, 0.4);
                font-size: 0.8rem;
                margin-top: 4px;
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
                animation: fadeIn 0.3s ease;
            }
            
            .image-item.new {
                animation: popIn 0.4s ease;
            }
            
            @keyframes popIn {
                0% { opacity: 0; transform: scale(0.8); }
                50% { transform: scale(1.05); }
                100% { opacity: 1; transform: scale(1); }
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
            
            .image-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .image-item:hover .image-overlay {
                opacity: 1;
            }
            
            .action-btn {
                width: 44px;
                height: 44px;
                border-radius: 50%;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                text-decoration: none;
            }
            
            .action-btn svg {
                width: 20px;
                height: 20px;
                fill: white;
            }
            
            .download-btn {
                background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            }
            
            .download-btn:hover {
                transform: scale(1.1);
                box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
            }
            
            .delete-btn {
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            }
            
            .delete-btn:hover {
                transform: scale(1.1);
                box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
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
            
            /* Progress bar */
            .progress-bar {
                display: none;
                width: 100%;
                height: 4px;
                background: rgba(255,255,255,0.1);
                border-radius: 2px;
                margin-top: 12px;
                overflow: hidden;
            }
            
            .progress-bar.show {
                display: block;
            }
            
            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #8b5cf6, #a78bfa);
                border-radius: 2px;
                transition: width 0.3s ease;
                width: 0%;
            }
            
            /* Modal xác nhận xóa */
            .modal-overlay {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                z-index: 1000;
                align-items: center;
                justify-content: center;
            }
            
            .modal-overlay.show {
                display: flex;
            }
            
            .modal {
                background: #1a1a3e;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 16px;
                padding: 32px;
                max-width: 400px;
                text-align: center;
                animation: fadeIn 0.2s ease;
            }
            
            .modal h3 {
                color: #fff;
                margin-bottom: 12px;
            }
            
            .modal p {
                color: rgba(255, 255, 255, 0.6);
                margin-bottom: 24px;
            }
            
            .modal-buttons {
                display: flex;
                gap: 12px;
                justify-content: center;
            }
            
            .modal-btn {
                padding: 12px 24px;
                border-radius: 8px;
                border: none;
                font-family: 'Outfit', sans-serif;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .modal-btn-cancel {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
            }
            
            .modal-btn-cancel:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            .modal-btn-delete {
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                color: #fff;
            }
            
            .modal-btn-delete:hover {
                box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
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
            
            <div id="messageContainer">
                ${errorBox}
                ${successBox}
                ${deleteSuccessBox}
            </div>
            
            <form id="uploadForm">
                <div class="upload-area" id="dropZone">
                    <div class="upload-icon">
                        <svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
                    </div>
                    <p class="upload-text" id="uploadText">Nhấn để chọn file hoặc kéo thả vào đây</p>
                    <p class="upload-hint">Hỗ trợ nhiều file PNG, tối đa 1MB/file</p>
                    <div class="progress-bar" id="progressBar">
                        <div class="progress-fill" id="progressFill"></div>
                    </div>
                </div>
                <input type="file" name="images" id="fileInput" multiple accept=".png,image/png">
                
                <div class="file-list" id="fileList"></div>
                
                <button type="submit" class="btn" id="submitBtn">
                    <span class="btn-text" id="btnText">Upload Ảnh</span>
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
        
        <!-- Modal xác nhận xóa -->
        <div class="modal-overlay" id="deleteModal">
            <div class="modal">
                <h3>🗑️ Xác nhận xóa</h3>
                <p>Bạn có chắc chắn muốn xóa ảnh này? Hành động này không thể hoàn tác.</p>
                <div class="modal-buttons">
                    <button class="modal-btn modal-btn-cancel" onclick="closeModal()">Hủy</button>
                    <button class="modal-btn modal-btn-delete" id="confirmDeleteBtn">Xóa ảnh</button>
                </div>
            </div>
        </div>
        
        <script>
            const dropZone = document.getElementById('dropZone');
            const fileInput = document.getElementById('fileInput');
            const fileList = document.getElementById('fileList');
            const uploadForm = document.getElementById('uploadForm');
            const submitBtn = document.getElementById('submitBtn');
            const btnText = document.getElementById('btnText');
            const loading = document.getElementById('loading');
            const deleteModal = document.getElementById('deleteModal');
            const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
            const progressBar = document.getElementById('progressBar');
            const progressFill = document.getElementById('progressFill');
            const uploadText = document.getElementById('uploadText');
            const messageContainer = document.getElementById('messageContainer');
            
            let imageToDelete = null;
            let currentImageCount = ${images.length};
            
            // Click để mở file picker
            dropZone.addEventListener('click', () => {
                if (!dropZone.classList.contains('uploading')) {
                    fileInput.click();
                }
            });
            
            // Drag & Drop
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!dropZone.classList.contains('uploading')) {
                    dropZone.classList.add('dragover');
                }
            });
            
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('dragover');
            });
            
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                if (!dropZone.classList.contains('uploading')) {
                    fileInput.files = e.dataTransfer.files;
                    updateFileList();
                }
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
            
            // AJAX Upload
            uploadForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const files = fileInput.files;
                if (files.length === 0) {
                    showMessage('error', 'Vui lòng chọn ít nhất một file ảnh PNG!');
                    return;
                }
                
                // Validate files
                for (let file of files) {
                    if (file.type !== 'image/png') {
                        showMessage('error', 'Chỉ chấp nhận file ảnh PNG!');
                        return;
                    }
                    if (file.size > 1024 * 1024) {
                        showMessage('error', 'File ' + file.name + ' quá lớn! Tối đa 1MB.');
                        return;
                    }
                }
                
                // Start upload
                setUploading(true);
                
                const formData = new FormData();
                for (let file of files) {
                    formData.append('images', file);
                }
                
                try {
                    const xhr = new XMLHttpRequest();
                    
                    xhr.upload.addEventListener('progress', (e) => {
                        if (e.lengthComputable) {
                            const percent = Math.round((e.loaded / e.total) * 100);
                            progressFill.style.width = percent + '%';
                            uploadText.textContent = 'Đang upload... ' + percent + '%';
                        }
                    });
                    
                    xhr.onload = function() {
                        if (xhr.status === 200) {
                            const result = JSON.parse(xhr.responseText);
                            if (result.success) {
                                // Thêm ảnh mới vào gallery ngay lập tức
                                addNewImages(result.images);
                                showMessage('success', 'Upload thành công ' + result.images.length + ' ảnh!');
                                fileList.innerHTML = '';
                                fileInput.value = '';
                            } else {
                                showMessage('error', result.error || 'Có lỗi xảy ra!');
                            }
                        } else {
                            showMessage('error', 'Có lỗi xảy ra khi upload!');
                        }
                        setUploading(false);
                    };
                    
                    xhr.onerror = function() {
                        showMessage('error', 'Lỗi kết nối!');
                        setUploading(false);
                    };
                    
                    xhr.open('POST', '/api/upload-ajax');
                    xhr.send(formData);
                    
                } catch (error) {
                    showMessage('error', 'Có lỗi xảy ra: ' + error.message);
                    setUploading(false);
                }
            });
            
            function setUploading(uploading) {
                if (uploading) {
                    dropZone.classList.add('uploading');
                    progressBar.classList.add('show');
                    progressFill.style.width = '0%';
                    btnText.style.display = 'none';
                    loading.classList.add('show');
                    submitBtn.disabled = true;
                } else {
                    dropZone.classList.remove('uploading');
                    progressBar.classList.remove('show');
                    uploadText.textContent = 'Nhấn để chọn file hoặc kéo thả vào đây';
                    btnText.style.display = 'inline';
                    loading.classList.remove('show');
                    submitBtn.disabled = false;
                }
            }
            
            function showMessage(type, text) {
                messageContainer.innerHTML = '';
                const div = document.createElement('div');
                div.className = type === 'error' ? 'error-box' : 'success-box';
                div.innerHTML = type === 'error' 
                    ? '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg><p>' + text + '</p>'
                    : '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg><p>' + text + '</p>';
                messageContainer.appendChild(div);
                
                // Auto hide after 5s
                setTimeout(() => {
                    div.style.opacity = '0';
                    setTimeout(() => div.remove(), 300);
                }, 5000);
            }
            
            function addNewImages(images) {
                let gallery = document.getElementById('imageGallery');
                const emptyGallery = document.getElementById('emptyGallery');
                const galleryHeader = document.getElementById('galleryHeader');
                
                // Nếu chưa có gallery, tạo mới
                if (!gallery) {
                    if (emptyGallery) emptyGallery.remove();
                    
                    // Tạo gallery header
                    if (!galleryHeader) {
                        const header = document.createElement('div');
                        header.className = 'gallery-header';
                        header.id = 'galleryHeader';
                        header.innerHTML = '<h2>🖼️ Thư viện ảnh (<span id="imageCount">0</span> ảnh)</h2><p class="gallery-hint">Hover vào ảnh để xem các tùy chọn</p>';
                        document.querySelector('.rules').before(header);
                    }
                    
                    // Tạo gallery
                    gallery = document.createElement('div');
                    gallery.className = 'image-gallery';
                    gallery.id = 'imageGallery';
                    document.querySelector('.rules').before(gallery);
                }
                
                // Thêm ảnh mới vào đầu gallery
                images.forEach((img, idx) => {
                    const div = document.createElement('div');
                    div.className = 'image-item new';
                    div.setAttribute('data-id', img.publicId);
                    div.innerHTML = \`
                        <img src="\${img.thumbUrl}" data-full="\${img.url}" alt="New image" loading="lazy">
                        <div class="image-overlay">
                            <a href="\${img.url}" download="image.png" class="action-btn download-btn" title="Tải xuống" target="_blank">
                                <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                            </a>
                            <button class="action-btn delete-btn" onclick="deleteImage('\${img.publicId}')" title="Xóa ảnh">
                                <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                            </button>
                        </div>
                    \`;
                    gallery.insertBefore(div, gallery.firstChild);
                    currentImageCount++;
                });
                
                // Cập nhật số lượng ảnh
                const countEl = document.getElementById('imageCount');
                if (countEl) countEl.textContent = currentImageCount;
            }
            
            // Xóa ảnh
            function deleteImage(publicId) {
                imageToDelete = publicId;
                deleteModal.classList.add('show');
            }
            
            function closeModal() {
                deleteModal.classList.remove('show');
                imageToDelete = null;
            }
            
            // Click ra ngoài modal để đóng
            deleteModal.addEventListener('click', (e) => {
                if (e.target === deleteModal) {
                    closeModal();
                }
            });
            
            // Xác nhận xóa
            confirmDeleteBtn.addEventListener('click', async () => {
                if (!imageToDelete) return;
                
                confirmDeleteBtn.disabled = true;
                confirmDeleteBtn.textContent = 'Đang xóa...';
                
                try {
                    const response = await fetch('/api/delete', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ publicId: imageToDelete })
                    });
                    
                    if (response.ok) {
                        // Xóa ảnh khỏi DOM
                        const item = document.querySelector('[data-id="' + imageToDelete + '"]');
                        if (item) {
                            item.style.opacity = '0';
                            item.style.transform = 'scale(0.8)';
                            setTimeout(() => {
                                item.remove();
                                currentImageCount--;
                                const countEl = document.getElementById('imageCount');
                                if (countEl) countEl.textContent = currentImageCount;
                                
                                // Nếu hết ảnh, hiện empty state
                                if (currentImageCount === 0) {
                                    const gallery = document.getElementById('imageGallery');
                                    const header = document.getElementById('galleryHeader');
                                    if (gallery) gallery.remove();
                                    if (header) header.remove();
                                    
                                    const empty = document.createElement('div');
                                    empty.className = 'empty-gallery';
                                    empty.id = 'emptyGallery';
                                    empty.innerHTML = '<svg viewBox="0 0 24 24" width="48" height="48"><path fill="rgba(255,255,255,0.2)" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg><p>Chưa có ảnh nào được upload</p>';
                                    document.querySelector('.rules').before(empty);
                                }
                            }, 300);
                        }
                        showMessage('success', 'Đã xóa ảnh thành công!');
                        closeModal();
                    } else {
                        const data = await response.json();
                        showMessage('error', 'Lỗi: ' + data.error);
                        closeModal();
                    }
                } catch (error) {
                    showMessage('error', 'Có lỗi xảy ra khi xóa ảnh');
                    closeModal();
                }
                
                confirmDeleteBtn.disabled = false;
                confirmDeleteBtn.textContent = 'Xóa ảnh';
            });
        </script>
    </body>
    </html>
    `;
}

// Route trang chủ - Hiển thị tất cả ảnh đã upload
app.get("/", async (req, res) => {
  // Set cache headers
  res.set("Cache-Control", "no-cache");
  const images = await getAllImages();
  const deleted = req.query.deleted === "true";
  res.send(generateHTML("", false, images, 0, deleted));
});

app.get("/api", async (req, res) => {
  res.set("Cache-Control", "no-cache");
  const images = await getAllImages();
  const deleted = req.query.deleted === "true";
  res.send(generateHTML("", false, images, 0, deleted));
});

// Route AJAX upload - Trả về JSON
app.post("/api/upload-ajax", (req, res) => {
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

      return res.json({ success: false, error: errorMessage });
    } else if (err) {
      return res.json({ success: false, error: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.json({
        success: false,
        error: "Vui lòng chọn ít nhất một file ảnh PNG!",
      });
    }

    try {
      // Upload tất cả ảnh lên Cloudinary
      const uploadPromises = req.files.map((file) =>
        uploadToCloudinary(file.buffer)
      );
      const results = await Promise.all(uploadPromises);

      // Trả về thông tin ảnh mới
      const images = results.map((result) => {
        const thumbUrl = result.secure_url.replace(
          "/upload/",
          "/upload/c_fill,w_300,h_300,q_auto,f_auto/"
        );
        return {
          url: result.secure_url,
          thumbUrl: thumbUrl,
          publicId: result.public_id,
        };
      });

      res.json({ success: true, images });
    } catch (uploadError) {
      console.error("Cloudinary upload error:", uploadError);
      res.json({
        success: false,
        error: "Lỗi khi upload lên Cloudinary: " + uploadError.message,
      });
    }
  });
});

// Route xử lý upload (legacy - redirect)
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
      const uploadPromises = req.files.map((file) =>
        uploadToCloudinary(file.buffer)
      );
      const results = await Promise.all(uploadPromises);
      const uploadCount = results.length;

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

// Route xóa ảnh
app.post("/api/delete", async (req, res) => {
  try {
    const { publicId } = req.body;

    if (!publicId) {
      return res.status(400).json({ error: "Thiếu publicId" });
    }

    await deleteFromCloudinary(publicId);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Export cho Vercel
module.exports = app;
