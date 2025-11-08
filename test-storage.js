const admin = require('firebase-admin');
const serviceAccount = require('C:/Users/sofia/AppData/Local/Temp/MicrosoftEdgeDownloads/8f9a050f-fbc3-4d03-b5f7-2ad10f76bdda/accizard-lucban-official-65ba3-firebase-adminsdk-fbsvc-619b85505d.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'accizard-lucban-official-65ba3.firebasestorage.app'
});
(async () => {
  const bucket = admin.storage().bucket();
  const file = bucket.file('healthcheck.txt');
  await file.save('ok', { resumable: false });
  const [contents] = await file.download();
  console.log('Storage read:', contents.toString());
  await file.delete();
  console.log('Storage delete: success');
  process.exit(0);
})().catch(err => {
  console.error('Storage test failed:', err);
  process.exit(1);
});
