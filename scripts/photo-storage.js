/**
 * StyleLog — Supabase Storage 에 화면용·원본 사진 업로드 후 public URL 반환.
 * DB에는 data URL 대신 짧은 URL만 넣어 PATCH/INSERT 부담과 statement_timeout 을 줄임.
 */

const STYLE_LOG_PHOTOS_BUCKET = 'style-log-photos';

/** 리스트·상세 표시용 (용량 우선) */
const DISPLAY_MAX_EDGE = 1920;
const DISPLAY_JPEG_QUALITY = 0.86;

/** 원본이 없을 때(앨범에서만 고른 경우) 데이터에서 뽑는 고화질 JPEG */
const DERIVED_ORIGINAL_MAX_EDGE = 4096;
const DERIVED_ORIGINAL_JPEG_QUALITY = 0.92;

function isRemoteHttpUrl(u) {
    return typeof u === 'string' && /^https?:\/\//i.test(u.trim());
}

function extFromImageMime(mime) {
    const m = String(mime || '').toLowerCase();
    if (m.includes('png')) return '.png';
    if (m.includes('webp')) return '.webp';
    return '.jpg';
}

function canvasToJpegBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('이미지 인코딩에 실패했습니다.'))),
            'image/jpeg',
            quality
        );
    });
}

/**
 * data URL 또는 이미지 URL을 로드해 한 변 최대 maxEdge 로 맞춘 JPEG Blob
 * @param {string} src
 */
async function jpegBlobResizeFromImageSrc(src, maxEdge, quality) {
    const img = new Image();
    if (isRemoteHttpUrl(src)) {
        img.crossOrigin = 'anonymous';
    }
    await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('사진을 불러올 수 없습니다.'));
        img.src = src;
    });

    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (!w || !h) throw new Error('사진 크기를 알 수 없습니다.');

    const scale = Math.min(1, maxEdge / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    return canvasToJpegBlob(canvas, quality);
}

function guessMimeFromDataUrl(dataUrl) {
    const m = /^data:([^;,]+)[;,]/i.exec(String(dataUrl || ''));
    return m ? m[1].trim().toLowerCase() : '';
}

/**
 * @param {typeof supabaseClient} client
 * @param {File} file
 * @param {string} destPath bucket 내 전체 경로
 */
async function uploadImageBlob(client, file, destPath, contentType) {
    const { error } = await client.storage.from(STYLE_LOG_PHOTOS_BUCKET).upload(destPath, file, {
        upsert: true,
        contentType: contentType || file.type || 'application/octet-stream',
        cacheControl: '31536000'
    });
    if (error) throw error;
}

function publicObjectUrl(client, path) {
    const { data } = client.storage.from(STYLE_LOG_PHOTOS_BUCKET).getPublicUrl(path);
    const u = data && data.publicUrl;
    if (!u) throw new Error('공개 URL을 만들 수 없습니다. 버킷이 public 인지 확인하세요.');
    return u;
}

/**
 * 선택된 사진을 Storage에 반영하고, DB에 넣을 display URL 목록 반환.
 * @param {typeof supabaseClient} client
 * @param {string} userId
 * @param {string} styleLogId
 * @param {Array<{ dataUrl?: string, file?: File|null }>} selectedPhotos
 * @returns {Promise<string[]>}
 */
async function publishStyleLogPhotosFromSelection(client, userId, styleLogId, selectedPhotos) {
    if (!userId || !styleLogId) {
        throw new Error('업로드에 필요한 사용자·로그 ID가 없습니다.');
    }
    if (!Array.isArray(selectedPhotos)) return [];

    const outDisplayUrls = [];

    for (let i = 0; i < selectedPhotos.length; i++) {
        const slot = selectedPhotos[i] || {};
        const raw = typeof slot.dataUrl === 'string' ? slot.dataUrl.trim() : '';
        if (!raw) continue;

        if (isRemoteHttpUrl(raw)) {
            outDisplayUrls.push(raw);
            continue;
        }

        if (!/^data:image\//i.test(raw)) {
            throw new Error('지원하지 않는 사진 형식입니다.');
        }

        const displayBlob = await jpegBlobResizeFromImageSrc(raw, DISPLAY_MAX_EDGE, DISPLAY_JPEG_QUALITY);

        /** @type {Blob} */
        let originalBlob;
        /** @type {string} */
        let originalContentType;

        const f = slot.file;
        if (f instanceof File && typeof f.type === 'string' && /^image\//i.test(f.type)) {
            originalBlob = f;
            originalContentType = f.type.split(';')[0].trim() || guessMimeFromDataUrl(raw) || 'image/jpeg';
        } else {
            originalBlob = await jpegBlobResizeFromImageSrc(raw, DERIVED_ORIGINAL_MAX_EDGE, DERIVED_ORIGINAL_JPEG_QUALITY);
            originalContentType = 'image/jpeg';
        }

        const base = `${userId}/${styleLogId}/${i}`;
        const displayPath = `${base}/display.jpg`;
        const origExt = extFromImageMime(originalContentType);
        const originalPath = `${base}/original${origExt}`;

        await uploadImageBlob(client, displayBlob, displayPath, 'image/jpeg');
        await uploadImageBlob(client, originalBlob, originalPath, originalContentType);

        outDisplayUrls.push(publicObjectUrl(client, displayPath));
    }

    return outDisplayUrls;
}
