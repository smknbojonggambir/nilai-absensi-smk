// Global variable for Spreadsheet ID
// GANTI INI DENGAN ID GOOGLE SHEETS ANDA YANG ASLI
const SPREADSHEET_ID = '1pBd3BS0C_iuXsw2drQ3J68w3bDACIz2riJDfTJYlyXs'; // <--- PASTIKAN INI ADALAH ID SPREADSHEET ANDA

/**
 * Fungsi doGet akan dipanggil saat aplikasi web diakses.
 * Ini bertanggung jawab untuk menyajikan file HTML utama.
 * @param {GoogleAppsScript.Events.DoGet} e - Objek event doGet.
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet(e) {
  // Mengambil template HTML dari file 'index.html' (perhatikan 'index' dengan 'i' kecil)
  // CSS dan JS akan di-embed di sini melalui tag scriptlet di index.html
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Fungsi doPost akan dipanggil saat aplikasi web menerima permintaan POST.
 * Ini menangani semua logika backend (CRUD, login, rekap, dll.).
 * @param {GoogleAppsScript.Events.DoPost} e - Objek event doPost.
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  const action = e.parameter.action;
  const sheetName = e.parameter.sheetName; // Sheet yang ditargetkan oleh aksi
  let data = {}; // Payload data dari frontend

  // Tangani payload JSON dari permintaan fetch (untuk data POST)
  if (e.postData && e.postData.contents) {
    try {
      data = JSON.parse(e.postData.contents);
    } catch (error) {
      return createErrorResponse('Invalid JSON data provided: ' + error.message);
    }
  }

  let result = {};
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID); // Buka spreadsheet spesifik
    const sheet = sheetName ? ss.getSheetByName(sheetName) : null;

    // Aksi yang tidak selalu membutuhkan parameter sheetName di awal
    if (!sheet && action !== 'login' && action !== 'readConfig' && action !== 'getStudentReport' && action !== 'createUser') {
      throw new Error(`Sheet '${sheetName}' not found.`);
    }

    switch (action) {
      case 'login':
        result = handleLogin(ss.getSheetByName('Users'), data.username, data.password);
        break;
      case 'read':
        result = readData(sheet);
        break;
      case 'create':
        result = createData(sheet, data);
        break;
      case 'update':
        result = updateData(sheet, data); // Membutuhkan identifikasi unik (kolom pertama diasumsikan)
        break;
      case 'delete':
        result = deleteData(sheet, data); // Membutuhkan identifikasi unik (kolom pertama diasumsikan)
        break;
      case 'bulkCreate': // Untuk mengimpor data Excel/CSV
        result = bulkCreateData(sheet, data.records);
        break;
      case 'readConfig':
        result = readConfig(ss.getSheetByName('Konfigurasi'));
        break;
      case 'inputAbsensi':
        result = inputAbsensi(ss.getSheetByName('Absensi'), data.absensiRecords);
        break;
      case 'getRekapAbsensi':
        result = getRekapAbsensi(ss.getSheetByName('Absensi'), ss.getSheetByName('Siswa'), data.filter);
        break;
      case 'inputNilai':
        result = inputNilai(ss.getSheetByName('Nilai'), data.nilaiRecord);
        break;
      case 'getRekapNilai':
        result = getRekapNilai(ss.getSheetByName('Nilai'), ss.getSheetByName('Siswa'), ss.getSheetByName('Konfigurasi'), data.filter);
        break;
      case 'createUser':
        result = createUser(ss.getSheetByName('Users'), data);
        break;
      case 'getStudentReport': // Aksi baru untuk laporan mandiri siswa
        result = getStudentReport(ss, data.filter);
        break;
      default:
        throw new Error('Invalid action.');
    }
  } catch (error) {
    result = createErrorResponse(error.message);
  }

  // Mengembalikan hasil dalam format JSON
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// Fungsi bantu untuk struktur respons error yang konsisten
function createErrorResponse(message) {
  return { status: 'error', message: message };
}

// --- CORE CRUD Functions ---

/**
 * Membaca semua data dari sheet yang diberikan.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Objek sheet dari mana data akan dibaca.
 * @returns {object} Objek dengan status dan data yang dibaca.
 */
function readData(sheet) {
  if (!sheet) return { status: 'success', data: [] }; // Tangani kasus di mana sheet mungkin null
  const range = sheet.getDataRange();
  const values = range.getDisplayValues(); // Dapatkan nilai seperti yang ditampilkan (terformat)

  if (values.length === 0 || values[0].length === 0) {
    return { status: 'success', data: [] };
  }

  const headers = values[0];
  const data = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rowObject = {};
    headers.forEach((header, index) => {
      rowObject[header] = row[index];
    });
    data.push(rowObject);
  }
  return { status: 'success', data: data };
}

/**
 * Membuat data baru di sheet yang diberikan.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Objek sheet tempat data akan ditambahkan.
 * @param {object} newData - Objek data baru yang akan ditambahkan.
 * @returns {object} Objek dengan status dan pesan.
 */
function createData(sheet, newData) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newRow = headers.map(header => newData[header] !== undefined ? newData[header] : '');
  sheet.appendRow(newRow);
  return { status: 'success', message: 'Data added successfully.', id: newData.ID_Siswa || newData.ID_User || 'Unknown ID' }; // Mengembalikan beberapa pengidentifikasi
}

/**
 * Membuat data dalam jumlah besar (bulk) di sheet yang diberikan.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Objek sheet tempat data akan ditambahkan.
 * @param {Array<object>} records - Array objek data yang akan ditambahkan.
 * @returns {object} Objek dengan status dan pesan.
 */
function bulkCreateData(sheet, records) {
  if (!records || records.length === 0) {
    return { status: 'error', message: 'No records provided for bulk creation.' };
  }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowsToAppend = records.map(record => {
    return headers.map(header => record[header] !== undefined ? record[header] : '');
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
  return { status: 'success', message: `${records.length} records added successfully.` };
}

/**
 * Memperbarui data yang ada di sheet yang diberikan.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Objek sheet tempat data akan diperbarui.
 * @param {object} updatedData - Objek data yang diperbarui, harus berisi ID unik.
 * @returns {object} Objek dengan status dan pesan.
 */
function updateData(sheet, updatedData) {
  // Diasumsikan kolom pertama adalah ID unik (misal: ID_Siswa, ID_User, ID_Absensi)
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idColumn = headers[0]; // Diasumsikan ID ada di kolom pertama
  const idToUpdate = updatedData[idColumn];

  if (!idToUpdate) {
    throw new Error(`Missing unique identifier '${idColumn}' for update operation.`);
  }

  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(idToUpdate)) { // Bandingkan sebagai string untuk robusta
      headers.forEach((header, colIndex) => {
        if (updatedData.hasOwnProperty(header)) {
          values[i][colIndex] = updatedData[header];
        }
      });
      sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
      return { status: 'success', message: 'Data updated successfully.' };
    }
  }
  return { status: 'error', message: 'Data not found for update.' };
}

/**
 * Menghapus data dari sheet yang diberikan.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Objek sheet tempat data akan dihapus.
 * @param {object} dataToDelete - Objek data yang akan dihapus, harus berisi ID unik.
 * @returns {object} Objek dengan status dan pesan.
 */
function deleteData(sheet, dataToDelete) {
  // Diasumsikan kolom pertama adalah ID unik (misal: ID_Siswa, ID_User, ID_Absensi)
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idColumn = headers[0]; // Diasumsikan ID ada di kolom pertama
  const idToDelete = dataToDelete[idColumn];

  if (!idToDelete) {
    throw new Error(`Missing unique identifier '${idColumn}' for delete operation.`);
  }

  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  for (let i = values.length - 1; i >= 1; i--) { // Iterasi mundur untuk menghapus baris dengan aman
    if (String(values[i][0]) === String(idToDelete)) {
      sheet.deleteRow(i + 1); // Sheet berbasis 1-indexed
      return { status: 'success', message: 'Data deleted successfully.' };
    }
  }
  return { status: 'error', message: 'Data not found for delete.' };
}

// --- Specific Business Logic Functions ---

/**
 * Menangani proses login pengguna.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} userSheet - Sheet 'Users'.
 * @param {string} username - Nama pengguna.
 * @param {string} password - Kata sandi.
 * @returns {object} Objek dengan status, pesan, dan peran pengguna jika berhasil.
 */
function handleLogin(userSheet, username, password) {
  if (!userSheet) return createErrorResponse('User sheet not found.');

  const users = readData(userSheet).data;
  const user = users.find(u => u.Username === username);

  if (user && user.Password_Hash === password) { // PERINGATAN: Dalam produksi, HASH KATA SANDI dengan aman!
    return { status: 'success', message: 'Login successful!', role: user.Role };
  } else {
    return { status: 'error', message: 'Invalid username or password.' };
  }
}

/**
 * Membuat pengguna baru.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} userSheet - Sheet 'Users'.
 * @param {object} userData - Data pengguna baru.
 * @returns {object} Objek dengan status, pesan, dan ID pengguna baru.
 */
function createUser(userSheet, userData) {
  // Dalam aplikasi nyata, hash kata sandi di sini sebelum menyimpan
  userData.Password_Hash = userData.password; // Untuk demo, penugasan langsung. Gunakan hashing nyata!
  userData.ID_User = 'USER_' + Utilities.getUuid(); // ID unik sederhana

  const headers = userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0];
  const newRow = headers.map(header => userData[header] !== undefined ? userData[header] : '');
  userSheet.appendRow(newRow);
  return { status: 'success', message: 'User created successfully.', id: userData.ID_User };
}

/**
 * Membaca data konfigurasi dari sheet 'Konfigurasi'.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} configSheet - Sheet 'Konfigurasi'.
 * @returns {object} Objek dengan status dan data konfigurasi.
 */
function readConfig(configSheet) {
  if (!configSheet) return createErrorResponse('Configuration sheet not found.');
  const configData = readData(configSheet).data;
  const config = {};
  configData.forEach(row => {
    if (row.Key) { // Pastikan Key ada
      config[row.Key] = row.Value;
    }
  });
  return { status: 'success', data: config };
}

/**
 * Memasukkan catatan absensi.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} absensiSheet - Sheet 'Absensi'.
 * @param {Array<object>} absensiRecords - Array catatan absensi.
 * @returns {object} Objek dengan status dan pesan.
 */
function inputAbsensi(absensiSheet, absensiRecords) {
  if (!absensiRecords || absensiRecords.length === 0) {
    return createErrorResponse('No absensi records provided.');
  }
  const headers = absensiSheet.getRange(1, 1, 1, absensiSheet.getLastColumn()).getValues()[0];
  const rowsToAppend = absensiRecords.map(record => {
    record.ID_Absensi = 'ABS_' + Utilities.getUuid(); // Hasilkan ID unik untuk setiap catatan absensi
    return headers.map(header => record[header] !== undefined ? record[header] : '');
  });
  absensiSheet.getRange(absensiSheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
  return { status: 'success', message: `${absensiRecords.length} absensi records saved.` };
}

/**
 * Mendapatkan rekap absensi berdasarkan filter.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} absensiSheet - Sheet 'Absensi'.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} siswaSheet - Sheet 'Siswa'.
 * @param {object} filter - Objek filter (misal: { ID_Siswa: 'SIS_001', month: '2025-07' }).
 * @returns {object} Objek dengan status dan data rekap absensi.
 */
function getRekapAbsensi(absensiSheet, siswaSheet, filter) {
  const allAbsensi = readData(absensiSheet).data;
  const allSiswa = readData(siswaSheet).data;
  const siswaMap = new Map(allSiswa.map(s => [s.ID_Siswa, s]));

  const rekap = {};

  allAbsensi.forEach(abs => {
    const siswaId = abs.ID_Siswa;
    const status = abs.Status_Kehadiran;
    const tanggal = abs.Tanggal; // Diasumsikan format 'YYYY-MM-DD'

    // Terapkan filter: berdasarkan ID_Siswa atau berdasarkan Bulan
    if (filter) {
      if (filter.ID_Siswa && String(siswaId) !== String(filter.ID_Siswa)) {
        return; // Lewati jika ID siswa tidak cocok
      }
      if (filter.month && !tanggal.startsWith(filter.month)) { // format bulan 'YYYY-MM'
        return; // Lewati jika bulan tidak cocok
      }
    }

    if (!rekap[siswaId]) {
      const siswa = siswaMap.get(siswaId);
      rekap[siswaId] = {
        ID_Siswa: siswaId,
        Nama_Lengkap: siswa ? siswa.Nama_Lengkap : 'Unknown',
        Kelas: siswa ? siswa.Kelas : 'Unknown',
        Hadir: 0, Sakit: 0, Izin: 0, Alpha: 0, Total: 0
      };
    }
    rekap[siswaId][status] = (rekap[siswaId][status] || 0) + 1;
    rekap[siswaId].Total++;
  });

  return { status: 'success', data: Object.values(rekap) };
}

/**
 * Memasukkan catatan nilai.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} nilaiSheet - Sheet 'Nilai'.
 * @param {object} nilaiRecord - Catatan nilai yang akan ditambahkan.
 * @returns {object} Objek dengan status dan pesan.
 */
function inputNilai(nilaiSheet, nilaiRecord) {
  nilaiRecord.ID_Nilai = 'NILAI_' + Utilities.getUuid(); // Hasilkan ID unik
  const headers = nilaiSheet.getRange(1, 1, 1, nilaiSheet.getLastColumn()).getValues()[0];
  const newRow = headers.map(header => nilaiRecord[header] !== undefined ? nilaiRecord[header] : '');
  nilaiSheet.appendRow(newRow);
  return { status: 'success', message: 'Nilai saved successfully.' };
}

/**
 * Mendapatkan rekap nilai berdasarkan filter.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} nilaiSheet - Sheet 'Nilai'.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} siswaSheet - Sheet 'Siswa'.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} configSheet - Sheet 'Konfigurasi'.
 * @param {object} filter - Objek filter (misal: { ID_Siswa: 'SIS_001', Mata_Pelajaran: 'Informatika' }).
 * @returns {object} Objek dengan status dan data rekap nilai.
 */
function getRekapNilai(nilaiSheet, siswaSheet, configSheet, filter) {
  const allNilai = readData(nilaiSheet).data;
  const allSiswa = readData(siswaSheet).data;
  const config = readConfig(configSheet).data;
  const KKM = parseFloat(config.KKM_DEFAULT || '75'); // KKM Default jika tidak ditemukan

  const siswaMap = new Map(allSiswa.map(s => [s.ID_Siswa, s]));
  const rekapPerSiswaMap = new Map(); // Simpan skor detail per siswa per mata pelajaran

  allNilai.forEach(nilai => {
    const siswaId = nilai.ID_Siswa;
    const mapel = nilai.Mata_Pelajaran;
    const kategori = nilai.Kategori_Nilai; // Disimpan untuk kemungkinan tampilan detail di masa depan
    const score = parseFloat(nilai.Nilai);

    // Terapkan filter
    if (filter) {
      if (filter.ID_Siswa && String(siswaId) !== String(filter.ID_Siswa)) {
        return;
      }
      if (filter.Mata_Pelajaran && String(mapel) !== String(filter.Mata_Pelajaran)) {
        return;
      }
      // Tambahkan filter lain seperti 'semester', 'tahun_ajaran' jika diperlukan
    }

    if (!rekapPerSiswaMap.has(siswaId)) {
      rekapPerSiswaMap.set(siswaId, {});
    }
    if (!rekapPerSiswaMap.get(siswaId)[mapel]) {
      rekapPerSiswaMap.get(siswaId)[mapel] = {
        scores: [],
        totalScore: 0,
        count: 0
      };
    }
    rekapPerSiswaMap.get(siswaId)[mapel].scores.push(score);
    rekapPerSiswaMap.get(siswaId)[mapel].totalScore += score;
    rekapPerSiswaMap.get(siswaId)[mapel].count++;
  });

  const finalRekap = [];
  rekapPerSiswaMap.forEach((mapelData, siswaId) => {
    const siswa = siswaMap.get(siswaId);
    if (!siswa) return; // Lewati jika siswa tidak ditemukan

    Object.keys(mapelData).forEach(mapel => {
      const currentMapelData = mapelData[mapel];
      const rataRata = currentMapelData.totalScore / currentMapelData.count;
      const statusKKM = rataRata >= KKM ? 'Lulus' : 'Tidak Lulus';

      finalRekap.push({
        ID_Siswa: siswaId,
        Nama_Lengkap: siswa.Nama_Lengkap,
        Kelas: siswa.Kelas,
        Mata_Pelajaran: mapel,
        Rata_Rata_Nilai: rataRata.toFixed(2), // Format ke 2 desimal
        Status_KKM: statusKKM
      });
    });
  });

  return { status: 'success', data: finalRekap };
}

// --- FITUR BARU: Laporan Mandiri Siswa ---
/**
 * Mendapatkan laporan lengkap (informasi siswa, nilai, absensi) untuk siswa tertentu.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss - Objek spreadsheet.
 * @param {object} filter - Objek filter (harus mengandung 'studentName').
 * @returns {object} Objek dengan status, pesan, dan laporan siswa.
 */
function getStudentReport(ss, filter) {
  const siswaSheet = ss.getSheetByName('Siswa');
  const nilaiSheet = ss.getSheetByName('Nilai');
  const absensiSheet = ss.getSheetByName('Absensi');
  const configSheet = ss.getSheetByName('Konfigurasi');

  if (!siswaSheet || !nilaiSheet || !absensiSheet || !configSheet) {
    throw new Error('One or more required sheets not found for student report.');
  }

  const studentName = filter.studentName;
  if (!studentName) {
    throw new Error('Student name is required for report.');
  }

  const allSiswa = readData(siswaSheet).data;
  // Pencarian nama siswa tidak peka huruf besar/kecil dan pencocokan parsial
  const matchedSiswa = allSiswa.filter(s =>
    s.Nama_Lengkap && s.Nama_Lengkap.toLowerCase().includes(studentName.toLowerCase())
  );

  if (matchedSiswa.length === 0) {
    return { status: 'success', message: 'Siswa tidak ditemukan.', studentReport: null };
  }
  if (matchedSiswa.length > 1) {
    // Jika lebih dari satu siswa cocok, kembalikan mereka agar frontend dapat meminta input yang lebih spesifik
    return { status: 'success', message: 'Ditemukan lebih dari satu siswa dengan nama serupa. Mohon lebih spesifik.', matchedStudents: matchedSiswa };
  }

  const targetStudent = matchedSiswa[0];
  const studentId = targetStudent.ID_Siswa;

  // Dapatkan Nilai untuk siswa
  const nilaiData = getRekapNilai(nilaiSheet, siswaSheet, configSheet, { ID_Siswa: studentId }).data;

  // Dapatkan Absensi untuk siswa (rekap bulanan untuk bulan saat ini)
  const currentMonth = new Date().toISOString().slice(0, 7); // Format YYYY-MM (e.g., "2025-07")
  const absensiData = getRekapAbsensi(absensiSheet, siswaSheet, { ID_Siswa: studentId, month: currentMonth }).data;
  // Temukan rekap absensi untuk siswa spesifik
  const studentAbsensiRekap = absensiData.find(a => String(a.ID_Siswa) === String(studentId)) || {
    Hadir: 0, Sakit: 0, Izin: 0, Alpha: 0, Total: 0
  };

  return {
    status: 'success',
    message: 'Laporan siswa berhasil dimuat.',
    studentReport: {
      studentInfo: targetStudent,
      nilaiReport: nilaiData,
      absensiReport: studentAbsensiRekap
    }
  };
}
