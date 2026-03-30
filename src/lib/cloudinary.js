const CLOUD_NAME = 'dttjycffp';
const UPLOAD_PRESET = 'player_photos';

export async function uploadToCloudinary(file, folder = '') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  if (folder) {
    formData.append('folder', folder);
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    throw new Error('Error al subir imagen');
  }

  const data = await response.json();
  return data.secure_url;
}
