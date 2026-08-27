// 브라우저에서 이미지를 리사이즈/압축하는 유틸.
// 문제집 커버 사진처럼 사용자가 큰 원본 이미지를 올려도
// 서버(Supabase Storage)에는 작은 JPEG로 줄여서 저장하기 위해 사용.

const MAX_DIMENSION = 960; // 가로/세로 중 긴 쪽 기준 최대 px
const JPEG_QUALITY = 0.82;

/**
 * File(이미지)을 받아 리사이즈 + JPEG 압축한 Blob을 반환.
 * 원본이 이미 충분히 작으면 그대로 압축만 적용.
 */
export function resizeImageToBlob(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      let { width, height } = img;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width >= height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      // 투명 배경(PNG)이 검은색으로 안 보이도록 흰 배경 깔고 그 위에 그림
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            reject(new Error("이미지 변환에 실패했습니다."));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지를 읽을 수 없습니다."));
    };

    img.src = objectUrl;
  });
}

const COVER_BUCKET = "question-set-covers";

/**
 * 문제집 커버 이미지를 리사이즈해서 Supabase Storage에 업로드하고
 * 공개 URL을 반환한다.
 */
export async function uploadCoverImage(supabase, file) {
  return uploadImage(supabase, file, COVER_BUCKET, "covers");
}

/**
 * 범용 이미지 업로드 - 리사이즈 후 지정한 버킷/폴더에 저장하고 공개 URL 반환.
 * (월드컵처럼 이미지가 여러 장 올라가는 기능에서도 재사용)
 */
export async function uploadImage(supabase, file, bucket, folder = "uploads") {
  const blob = await resizeImageToBlob(file);
  const path = `${folder}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
