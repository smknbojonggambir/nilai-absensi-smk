// Global variable for Spreadsheet ID
// GANTI INI DENGAN ID GOOGLE SHEETS ANDA YANG ASLI
const SPREADSHEET_ID = '1pBd3BS0C_iuXsw2drQ3J68w3bDACIz2riJDnTJYlyXs'; // <--- PASTIKAN INI ADALAH ID SPREADSHEET ANDA

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
      // Log error untuk debugging di Stackdriver Logging
      console.error('Error parsing JSON data:', error.message, e.postData.contents);
      return createErrorResponse('Invalid JSON data provided: ' + error.message);
    }
  }

  let result = {};
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID); // Buka spreadsheet spesifik

    // Pengecekan sheet yang lebih terpusat dan penanganan error
    let sheet = null;
    if (sheetName) {
      sheet = ss.getSheetByName(sheetName);
      if (!sheet && action !== 'login' && action !== 'readConfig' && action !== 'getStudentReport' && action !== 'createUser') {
        // Hanya lembar yang diperlukan untuk tindakan tertentu yang diizinkan menjadi null
        throw new Error(`Sheet '${sheetName}' not found.`);
      }
    }

    switch (action) {
      case 'login':
        // Pastikan sheet 'Users' ada untuk login
        const userSheetLogin = ss.getSheetByName('Users');
        if (!userSheetLogin) throw new Error('User sheet not found for login.');
        result = handleLogin(userSheetLogin, data.username, data.password);
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
        const configSheetRead = ss.getSheetByName('Konfigurasi');
        if (!configSheetRead) throw new Error('Configuration sheet not found.');
        result = readConfig(configSheetRead);
        break;
      case 'inputAbsensi':
        const absensiSheetInput = ss.getSheetByName('Absensi');
        if (!absensiSheetInput) throw new Error('Absensi sheet not found.');
        result = inputAbsensi(absensiSheetInput, data.absensiRecords);
        break;
      case 'getRekapAbsensi':
        const absensiSheetRekap = ss.getSheetByName('Absensi');
        const siswaSheetRekapAbs = ss.getSheetByName('Siswa');
        if (!absensiSheetRekap || !siswaSheetRekapAbs) throw new Error('Absensi or Siswa sheet not found for rekap absensi.');
        result = getRekapAbsensi(absensiSheetRekap, siswaSheetRekapAbs, data.filter);
        break;
      case 'inputNilai':
        const nilaiSheetInput = ss.getSheetByName('Nilai');
        if (!nilaiSheetInput) throw new Error('Nilai sheet not found.');
        result = inputNilai(nilaiSheetInput, data.nilaiRecord);
        break;
      case 'getRekapNilai':
        const nilaiSheetRekap = ss.getSheetByName('Nilai');
        const siswaSheetRekapNilai = ss.getSheetByName('Siswa');
        const configSheetRekap = ss.getSheetByName('Konfigurasi');
        if (!nilaiSheetRekap || !siswaSheetRekapNilai || !configSheetRekap) throw new Error('Nilai, Siswa, or Konfigurasi sheet not found for rekap nilai.');
        result = getRekapNilai(nilaiSheetRekap, siswaSheetRekapNilai, configSheetRekap, data.filter);
        break;
      case 'createUser':
        const userSheetCreate = ss.getSheetByName('Users');
        if (!userSheetCreate) throw new Error('User sheet not found for user creation.');
        result = createUser(userSheetCreate, data);
        break;
      case 'getStudentReport': // Aksi baru untuk laporan mandiri siswa
        result = getStudentReport(ss, data.filter);
        break;
      default:
        throw new Error('Invalid action: ' + action);
    }
  } catch (error) {
    // Log error lengkap untuk debugging
    console.error('Error in doPost for action:', action, 'Error:', error.message, error.stack);
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
 * Mengembalikan data sebagai array objek, dengan baris pertama sebagai header.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Objek sheet dari mana data akan dibaca.
 * @returns {object} Objek dengan status dan data yang dibaca.
 */
function readData(sheet) {
  if (!sheet) {
    // Ini seharusnya sudah ditangani oleh pengecekan di doPost, tapi sebagai fallback
    return { status: 'error', message: 'Sheet provided is null or undefined.' };
  }

  const range = sheet.getDataRange();
  const values = range.getDisplayValues(); // Dapatkan nilai seperti yang ditampilkan (terformat)
  // Catatan: getValues() akan mengembalikan nilai mentah, yang mungkin lebih baik untuk manipulasi data.
  // getDisplayValues() bagus jika Anda ingin nilai yang diformat (misalnya, tanggal sebagai string).

  if (values.length === 0 || values[0].length === 0) {
    return { status: 'success', data: [] };
  }

  const headers = values[0];
  const data = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rowObject = {};
    headers.forEach((header, index) => {
      // Pastikan header tidak kosong untuk menghindari masalah properti objek
      if (header) {
        rowObject[header] = row[index];
      }
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
  if (!sheet) throw new Error('Sheet is null for create operation.');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newRow = headers.map(header => newData.hasOwnProperty(header) ? newData[header] : '');
  sheet.appendRow(newRow);
  // Mengembalikan ID yang relevan jika ada, atau pesan sukses
  const idKey = headers.find(h => h.includes('ID_')); // Cari header yang mengandung 'ID_'
  return { status: 'success', message: 'Data added successfully.', id: idKey ? newData[idKey] : 'Unknown ID' };
}

/**
 * Membuat data dalam jumlah besar (bulk) di sheet yang diberikan.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Objek sheet tempat data akan ditambahkan.
 * @param {Array<object>} records - Array objek data yang akan ditambahkan.
 * @returns {object} Objek dengan status dan pesan.
 */
function bulkCreateData(sheet, records) {
  if (!sheet) throw new Error('Sheet is null for bulkCreate operation.');
  if (!records || records.length === 0) {
    return { status: 'error', message: 'No records provided for bulk creation.' };
  }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowsToAppend = records.map(record => {
    return headers.map(header => record.hasOwnProperty(header) ? record[header] : '');
  });

  // Pastikan ada data untuk ditulis dan tidak ada baris kosong
  if (rowsToAppend.length > 0 && rowsToAppend[0].length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
    return { status: 'success', message: `${records.length} records added successfully.` };
  } else {
    return { status: 'error', message: 'No valid data to append for bulk creation.' };
  }
}

/**
 * Memperbarui data yang ada di sheet yang diberikan.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Objek sheet tempat data akan diperbarui.
 * @param {object} updatedData - Objek data yang diperbarui, harus berisi ID unik.
 * @returns {object} Objek dengan status dan pesan.
 */
function updateData(sheet, updatedData) {
  if (!sheet) throw new Error('Sheet is null for update operation.');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idColumn = headers[0]; // Diasumsikan kolom pertama adalah ID unik

  const idToUpdate = updatedData[idColumn];
  if (!idToUpdate) {
    throw new Error(`Missing unique identifier '${idColumn}' for update operation.`);
  }

  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues(); // Gunakan getValues() untuk nilai mentah

  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) { // BUG FIXED: Loop harus maju (i++)
    if (String(values[i][0]) === String(idToUpdate)) { // Bandingkan sebagai string untuk robusta
      rowIndex = i;
      break;
    }
  }

  if (rowIndex !== -1) {
    // Perbarui nilai di baris yang ditemukan
    headers.forEach((header, colIndex) => {
      if (updatedData.hasOwnProperty(header)) {
        values[rowIndex][colIndex] = updatedData[header];
      }
    });
    // Setel kembali seluruh rentang data untuk menerapkan perubahan
    sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
    return { status: 'success', message: 'Data updated successfully.' };
  } else {
    return { status: 'error', message: 'Data not found for update.' };
  }
}

/**
 * Menghapus data dari sheet yang diberikan.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Objek sheet tempat data akan dihapus.
 * @param {object} dataToDelete - Objek data yang akan dihapus, harus berisi ID unik.
 * @returns {object} Objek dengan status dan pesan.
 */
function deleteData(sheet, dataToDelete) {
  if (!sheet) throw new Error('Sheet is null for delete operation.');
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
 * @param {string} password - Kata sandi yang dimasukkan pengguna.
 * @returns {object} Objek dengan status, pesan, dan peran pengguna jika berhasil.
 */
function handleLogin(userSheet, username, password) {
  if (!userSheet) return createErrorResponse('User sheet not found.');

  const users = readData(userSheet).data;
  const user = users.find(u => u.Username === username);

  if (user) {
    // HASH KATA SANDI YANG DIMASUKKAN UNTUK PERBANDINGAN
    const hashedPassword = hashPassword(password);
    if (user.Password_Hash === hashedPassword) {
      return { status: 'success', message: 'Login successful!', role: user.Role };
    }
  }
  return { status: 'error', message: 'Invalid username or password.' };
}

/**
 * Membuat pengguna baru.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} userSheet - Sheet 'Users'.
 * @param {object} userData - Data pengguna baru (harus termasuk 'username' dan 'password').
 * @returns {object} Objek dengan status, pesan, dan ID pengguna baru.
 */
function createUser(userSheet, userData) {
  if (!userSheet) throw new Error('User sheet not found for user creation.');
  if (!userData.username || !userData.password) {
    throw new Error('Username and password are required to create a user.');
  }

  // HASH KATA SANDI SEBELUM MENYIMPAN
  userData.Password_Hash = hashPassword(userData.password);
  userData.ID_User = 'USER_' + Utilities.getUuid(); // ID unik sederhana

  // Hapus properti password mentah sebelum menyimpan ke sheet
  delete userData.password;

  const headers = userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0];
  const newRow = headers.map(header => userData.hasOwnProperty(header) ? userData[header] : '');
  userSheet.appendRow(newRow);
  return { status: 'success', message: 'User created successfully.', id: userData.ID_User };
}

/**
 * Fungsi bantu untuk hashing kata sandi.
 * PENTING: Untuk aplikasi produksi, pertimbangkan solusi hashing yang lebih kuat
 * yang mendukung salting dan iterasi (misalnya, bcrypt).
 * Apps Script tidak memiliki fungsi bcrypt bawaan. Utilities.computeDigest
 * adalah pilihan terbaik yang tersedia untuk hashing satu arah sederhana.
 * @param {string} password - Kata sandi mentah.
 * @returns {string} Kata sandi yang di-hash (Base64 encoded).
 */
function hashPassword(password) {
  // Untuk keamanan yang lebih baik, tambahkan 'salt' unik per pengguna
  // const salt = Utilities.getUuid(); // Hasilkan salt unik
  // const combined = password + salt;
  // const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, combined);
  // return Utilities.base64Encode(digest) + ':' + salt; // Simpan salt bersama hash

  // Untuk demo sederhana tanpa salt (kurang aman)
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return Utilities.base64Encode(digest);
}


/**
 * Membaca data konfigurasi dari sheet 'Konfigurasi'.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} configSheet - Sheet 'Konfigurasi'.
 * @returns {object} Objek dengan status dan data konfigurasi.
 */
function readConfig(configSheet) {
  if (!configSheet) throw new Error('Configuration sheet not found.');
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
  if (!absensiSheet) throw new Error('Absensi sheet not found.');
  if (!absensiRecords || absensiRecords.length === 0) {
    return createErrorResponse('No absensi records provided.');
  }
  const headers = absensiSheet.getRange(1, 1, 1, absensiSheet.getLastColumn()).getValues()[0];
  const rowsToAppend = absensiRecords.map(record => {
    // Hasilkan ID unik hanya jika belum ada (misalnya, jika diimpor dari eksternal)
    record.ID_Absensi = record.ID_Absensi || 'ABS_' + Utilities.getUuid();
    return headers.map(header => record.hasOwnProperty(header) ? record[header] : '');
  });

  if (rowsToAppend.length > 0 && rowsToAppend[0].length > 0) {
    absensiSheet.getRange(absensiSheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
    return { status: 'success', message: `${absensiRecords.length} absensi records saved.` };
  } else {
    return { status: 'error', message: 'No valid absensi data to append.' };
  }
}

/**
 * Mendapatkan rekap absensi berdasarkan filter.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} absensiSheet - Sheet 'Absensi'.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} siswaSheet - Sheet 'Siswa'.
 * @param {object} filter - Objek filter (misal: { ID_Siswa: 'SIS_001', month: '2025-07' }).
 * @returns {object} Objek dengan status dan data rekap absensi.
 */
function getRekapAbsensi(absensiSheet, siswaSheet, filter) {
  if (!absensiSheet || !siswaSheet) throw new Error('Absensi or Siswa sheet not found.');

  const allAbsensi = readData(absensiSheet).data;
  const allSiswa = readData(siswaSheet).data;
  const siswaMap = new Map(allSiswa.map(s => [String(s.ID_Siswa), s])); // Pastikan kunci adalah string

  const rekap = {};

  allAbsensi.forEach(abs => {
    const siswaId = String(abs.ID_Siswa); // Pastikan ID siswa adalah string
    const status = abs.Status_Kehadiran;
    const tanggal = abs.Tanggal; // Diasumsikan format 'YYYY-MM-DD'

    // Terapkan filter: berdasarkan ID_Siswa atau berdasarkan Bulan
    if (filter) {
      if (filter.ID_Siswa && siswaId !== String(filter.ID_Siswa)) {
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
    // Pastikan status adalah properti yang valid dan inisialisasi jika belum ada
    if (rekap[siswaId].hasOwnProperty(status)) {
      rekap[siswaId][status]++;
    } else {
      // Jika ada status yang tidak terduga, mungkin ingin menanganinya
      // rekap[siswaId][status] = 1;
      console.warn(`Unexpected attendance status: ${status} for student ${siswaId}`);
    }
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
  if (!nilaiSheet) throw new Error('Nilai sheet not found.');
  nilaiRecord.ID_Nilai = nilaiRecord.ID_Nilai || 'NILAI_' + Utilities.getUuid(); // Hasilkan ID unik jika belum ada
  const headers = nilaiSheet.getRange(1, 1, 1, nilaiSheet.getLastColumn()).getValues()[0];
  const newRow = headers.map(header => nilaiRecord.hasOwnProperty(header) ? nilaiRecord[header] : '');
  nilaiSheet.appendRow(newRow);
  return { status: 'success', message: 'Nilai saved successfully.', id: nilaiRecord.ID_Nilai };
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
  if (!nilaiSheet || !siswaSheet || !configSheet) throw new Error('Nilai, Siswa, or Konfigurasi sheet not found.');

  const allNilai = readData(nilaiSheet).data;
  const allSiswa = readData(siswaSheet).data;
  const config = readConfig(configSheet).data;
  const KKM = parseFloat(config.KKM_DEFAULT || '75'); // KKM Default jika tidak ditemukan

  const siswaMap = new Map(allSiswa.map(s => [String(s.ID_Siswa), s]));
  const rekapPerSiswaMap = new Map(); // Simpan skor detail per siswa per mata pelajaran

  allNilai.forEach(nilai => {
    const siswaId = String(nilai.ID_Siswa);
    const mapel = nilai.Mata_Pelajaran;
    const kategori = nilai.Kategori_Nilai; // Disimpan untuk kemungkinan tampilan detail di masa depan
    const score = parseFloat(nilai.Nilai);

    // Validasi score
    if (isNaN(score)) {
      console.warn(`Invalid score encountered for student ${siswaId}, subject ${mapel}: ${nilai.Nilai}. Skipping this record.`);
      return;
    }

    // Terapkan filter
    if (filter) {
      if (filter.ID_Siswa && siswaId !== String(filter.ID_Siswa)) {
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
    if (!siswa) {
      console.warn(`Student with ID ${siswaId} not found in Siswa sheet.`);
      return; // Lewati jika siswa tidak ditemukan
    }

    Object.keys(mapelData).forEach(mapel => {
      const currentMapelData = mapelData[mapel];
      const rataRata = currentMapelData.count > 0 ? currentMapelData.totalScore / currentMapelData.count : 0;
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
    throw new Error('One or more required sheets (Siswa, Nilai, Absensi, Konfigurasi) not found for student report.');
  }

  const studentName = filter.studentName;
  if (!studentName) {
    throw new Error('Student name is required for report.');
  }

  const allSiswa = readData(siswaSheet).data;
  // Pencarian nama siswa tidak peka huruf besar/kecil dan pencocokan parsial
  const matchedSiswa = allSiswa.filter(s =>
    s.Nama_Lengkap && String(s.Nama_Lengkap).toLowerCase().includes(String(studentName).toLowerCase())
  );

  if (matchedSiswa.length === 0) {
    return { status: 'success', message: 'Siswa tidak ditemukan.', studentReport: null };
  }
  if (matchedSiswa.length > 1) {
    // Jika lebih dari satu siswa cocok, kembalikan mereka agar frontend dapat meminta input yang lebih spesifik
    return { status: 'success', message: 'Ditemukan lebih dari satu siswa dengan nama serupa. Mohon lebih spesifik.', matchedStudents: matchedSiswa };
  }

  const targetStudent = matchedSiswa[0];
  const studentId = String(targetStudent.ID_Siswa); // Pastikan ID siswa adalah string

  // Dapatkan Nilai untuk siswa
  const nilaiData = getRekapNilai(nilaiSheet, siswaSheet, configSheet, { ID_Siswa: studentId }).data;

  // Dapatkan Absensi untuk siswa (rekap bulanan untuk bulan saat ini)
  const currentMonth = new Date().toISOString().slice(0, 7); // Format YYYY-MM (e.g., "2025-07")
  const absensiData = getRekapAbsensi(absensiSheet, siswaSheet, { ID_Siswa: studentId, month: currentMonth }).data;
  // Temukan rekap absensi untuk siswa spesifik
  const studentAbsensiRekap = absensiData.find(a => String(a.ID_Siswa) === studentId) || {
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
