// js/script.js

// !!! PENTING: GANTI DENGAN URL WEB APP DEPLOYMENT ANDA !!!
const APP_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID_HERE/exec';

// --- DOM Elements Cache ---
const DOM = {
    loginSection: document.getElementById('login-section'),
    loginForm: document.getElementById('login-form'),
    loginMessage: document.getElementById('login-message'),
    appContent: document.getElementById('app-content'),
    mainNav: document.getElementById('main-nav'),
    adminMenu: document.getElementById('admin-menu'),
    loadingOverlay: document.getElementById('loading-overlay'),
    logoutBtn: document.getElementById('logout-btn')
};

// --- Global State ---
let currentUserRole = null;
let appConfig = {}; // Stores classes, subjects, KKM etc. fetched from 'Konfigurasi' sheet

// --- Utility Functions ---
const showLoading = () => DOM.loadingOverlay.classList.remove('hidden');
const hideLoading = () => DOM.loadingOverlay.classList.add('hidden');

const showMessage = (element, msg, type = 'error') => {
    element.textContent = msg;
    element.className = `message ${type}`;
    element.classList.remove('hidden');
};

const clearMessage = (element) => {
    element.textContent = '';
    element.classList.add('hidden');
};

// Generic function to make API calls to Google Apps Script
const fetchData = async (action, sheetName = null, data = {}) => {
    showLoading();
    const formData = new FormData();
    formData.append('action', action);
    if (sheetName) formData.append('sheetName', sheetName);
    if (Object.keys(data).length > 0) {
        formData.append('contents', JSON.stringify(data));
    }

    try {
        const response = await fetch(APP_SCRIPT_URL, {
            method: 'POST',
            body: formData,
        });
        const result = await response.json();
        if (result.status === 'error') {
            console.error('API Error:', result.message);
            throw new Error(result.message);
        }
        return result;
    } catch (error) {
        console.error('Fetch Error:', error);
        throw new Error(`Terjadi kesalahan jaringan atau server: ${error.message}`);
    } finally {
        hideLoading();
    }
};

// Function to render a new page content with fade effect
const renderPage = (htmlContent) => {
    const currentCard = DOM.appContent.querySelector('.card.active');
    if (currentCard) {
        currentCard.classList.remove('active');
        currentCard.classList.add('fade-in');
        setTimeout(() => {
            currentCard.remove();
            const newCard = document.createElement('section');
            newCard.className = 'card fade-in';
            newCard.innerHTML = htmlContent;
            DOM.appContent.appendChild(newCard);
            setTimeout(() => newCard.classList.add('active'), 50); // Small delay for fade-in
        }, 500); // Wait for fade-out transition
    } else {
        const newCard = document.createElement('section');
        newCard.className = 'card fade-in';
        newCard.innerHTML = htmlContent;
        DOM.appContent.appendChild(newCard);
        setTimeout(() => newCard.classList.add('active'), 50);
    }
};

// --- Authentication & Navigation ---
const handleLogin = async (e) => {
    e.preventDefault();
    clearMessage(DOM.loginMessage);
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const result = await fetchData('login', null, { username, password });
        currentUserRole = result.role;
        showMessage(DOM.loginMessage, result.message, 'success');
        await loadAppConfig(); // Load app configuration after successful login
        showDashboard();
    } catch (error) {
        showMessage(DOM.loginMessage, error.message);
    }
};

const showDashboard = () => {
    DOM.loginSection.classList.add('hidden');
    DOM.mainNav.classList.remove('hidden');
    if (currentUserRole === 'Admin') {
        DOM.adminMenu.classList.remove('hidden');
    } else {
        DOM.adminMenu.classList.add('hidden');
    }
    loadDashboardContent();
};

const handleLogout = () => {
    currentUserRole = null;
    appConfig = {}; // Clear config on logout
    DOM.mainNav.classList.add('hidden');
    DOM.adminMenu.classList.add('hidden');
    DOM.appContent.innerHTML = ''; // Clear main content
    DOM.loginSection.classList.remove('hidden');
    clearMessage(DOM.loginMessage);
    document.getElementById('login-form').reset(); // Reset login form
};

// --- Page Loaders ---
const loadDashboardContent = () => {
    renderPage(`
        <h2><i class="fas fa-chart-line"></i> Dashboard</h2>
        <p class="text-center">Selamat datang di Aplikasi Nilai & Absen Siswa SMK, **${currentUserRole}**!</p>
        <div class="dashboard-stats">
            <div class="stat-card"><h3>Total Siswa</h3><p id="total-siswa-stat"><i class="fas fa-spinner fa-spin"></i></p></div>
            <div class="stat-card"><h3>Total Kelas</h3><p id="total-kelas-stat"><i class="fas fa-spinner fa-spin"></i></p></div>
        </div>
        <div class="chart-container" style="height: 350px;">
            <h3>Grafik Kehadiran Bulan Ini (Contoh)</h3>
            <canvas id="absensiChart"></canvas>
        </div>
    `);
    fetchDashboardStats();
};

const fetchDashboardStats = async () => {
    try {
        const siswaResult = await fetchData('read', 'Siswa');
        document.getElementById('total-siswa-stat').textContent = siswaResult.data.length;

        const classes = appConfig.CLASSES ? appConfig.CLASSES.split(',') : [];
        document.getElementById('total-kelas-stat').textContent = classes.length;

        // Example: Fetch real absensi data for dashboard chart
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const absensiResult = await fetchData('getRekapAbsensi', 'Absensi', { filter: { month: currentMonth } });

        const dailyCounts = {}; // { 'YYYY-MM-DD': { Hadir: N, Alpha: M, ... } }
        absensiResult.data.forEach(rekap => {
            // This rekap is per student. To get daily total, we need to restructure
            // For simplicity, let's just count total present/absent for the month
            // A more robust solution would group by date in Apps Script
        });
        // For demonstration, let's use dummy data or a simplified sum
        const totalHadir = absensiResult.data.reduce((sum, s) => sum + s.Hadir, 0);
        const totalAlpha = absensiResult.data.reduce((sum, s) => sum + s.Alpha, 0);
        const totalSakit = absensiResult.data.reduce((sum, s) => sum + s.Sakit, 0);
        const totalIzin = absensiResult.data.reduce((sum, s) => sum + s.Izin, 0);

        const ctx = document.getElementById('absensiChart').getContext('2d');
        new Chart(ctx, {
            type: 'pie', // Pie chart for overall monthly status
            data: {
                labels: ['Hadir', 'Alpha', 'Sakit', 'Izin'],
                datasets: [{
                    label: `Kehadiran Bulan ${currentMonth}`,
                    data: [totalHadir, totalAlpha, totalSakit, totalIzin],
                    backgroundColor: [
                        'rgba(76, 175, 80, 0.8)', // Hadir
                        'rgba(255, 99, 132, 0.8)', // Alpha
                        'rgba(255, 206, 86, 0.8)', // Sakit
                        'rgba(54, 162, 235, 0.8)'  // Izin
                    ],
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Ringkasan Kehadiran Bulanan'
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        document.getElementById('total-siswa-stat').textContent = 'N/A';
        document.getElementById('total-kelas-stat').textContent = 'N/A';
        // Clear chart area or show error
        document.getElementById('absensiChart').getContext('2d').clearRect(0, 0, 0, 0);
    }
};

const loadSiswaManagement = async () => {
    renderPage(`
        <h2><i class="fas fa-users"></i> Data Siswa</h2>
        <div class="btn-group">
            <button id="add-siswa-btn" class="btn btn-primary"><i class="fas fa-user-plus"></i> Tambah Siswa Baru</button>
            <label for="import-siswa-file" class="btn btn-secondary"><i class="fas fa-file-import"></i> Import Data Siswa</label>
            <input type="file" id="import-siswa-file" accept=".csv, .xlsx" class="hidden">
            <button id="export-siswa-btn" class="btn btn-secondary"><i class="fas fa-file-export"></i> Export Data Siswa</button>
        </div>
        <div id="siswa-form-container" class="card hidden"></div>
        <div id="siswa-list-container" class="data-table-container card"></div>
    `);

    document.getElementById('add-siswa-btn').addEventListener('click', showAddSiswaForm);
    document.getElementById('import-siswa-file').addEventListener('change', handleImportSiswa);
    document.getElementById('export-siswa-btn').addEventListener('click', exportSiswaData);

    await fetchAndRenderSiswa();
};

const showAddSiswaForm = (siswaData = null) => {
    const formContainer = document.getElementById('siswa-form-container');
    formContainer.classList.remove('hidden'); // Show the form container
    const classes = appConfig.CLASSES ? appConfig.CLASSES.split(',') : [];
    const classOptions = classes.map(cls => `<option value="${cls}">${cls}</option>`).join('');

    formContainer.innerHTML = `
        <h3><i class="fas fa-plus-circle"></i> Form Tambah/Edit Siswa</h3>
        <form id="siswa-form">
            <input type="hidden" id="siswa-id" value="${siswaData ? siswaData.ID_Siswa : ''}">
            <div class="form-group">
                <label for="nama-lengkap">Nama Lengkap</label>
                <input type="text" id="nama-lengkap" value="${siswaData ? siswaData.Nama_Lengkap : ''}" required>
            </div>
            <div class="form-group">
                <label for="nis">NIS</label>
                <input type="text" id="nis" value="${siswaData ? siswaData.NIS : ''}" required>
            </div>
            <div class="form-group">
                <label for="kelas">Kelas</label>
                <select id="kelas" required>
                    <option value="">Pilih Kelas</option>
                    ${classOptions}
                </select>
            </div>
            <div class="form-group">
                <label for="jenis-kelamin">Jenis Kelamin</label>
                <select id="jenis-kelamin">
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                </select>
            </div>
            <div class="form-group">
                <label for="tanggal-lahir">Tanggal Lahir</label>
                <input type="date" id="tanggal-lahir" value="${siswaData ? siswaData.Tanggal_Lahir : ''}">
            </div>
            <div class="form-group">
                <label for="alamat">Alamat</label>
                <textarea id="alamat">${siswaData ? siswaData.Alamat : ''}</textarea>
            </div>
            <div class="form-group">
                <label for="nomor-telepon-ortu">Nomor Telepon Ortu</label>
                <input type="text" id="nomor-telepon-ortu" value="${siswaData ? siswaData.Nomor_Telepon_Ortu : ''}">
            </div>
            <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Simpan Siswa</button>
            <button type="button" class="btn btn-secondary" id="cancel-siswa-edit"><i class="fas fa-times"></i> Batal</button>
        </form>
        <p id="siswa-form-message" class="message hidden"></p>
    `;
    // Pre-select values if editing
    if (siswaData) {
        document.getElementById('kelas').value = siswaData.Kelas;
        document.getElementById('jenis-kelamin').value = siswaData.Jenis_Kelamin;
    }

    const siswaForm = document.getElementById('siswa-form');
    siswaForm.addEventListener('submit', handleSiswaFormSubmit);
    document.getElementById('cancel-siswa-edit').addEventListener('click', () => formContainer.classList.add('hidden'));
};

const handleSiswaFormSubmit = async (e) => {
    e.preventDefault();
    const formMessage = document.getElementById('siswa-form-message');
    clearMessage(formMessage);

    const siswaId = document.getElementById('siswa-id').value;
    const newSiswa = {
        ID_Siswa: siswaId || 'SIS_' + Date.now(), // Generate simple unique ID if new
        Nama_Lengkap: document.getElementById('nama-lengkap').value,
        NIS: document.getElementById('nis').value,
        Kelas: document.getElementById('kelas').value,
        Jenis_Kelamin: document.getElementById('jenis-kelamin').value,
        Tanggal_Lahir: document.getElementById('tanggal-lahir').value,
        Alamat: document.getElementById('alamat').value,
        Nomor_Telepon_Ortu: document.getElementById('nomor-telepon-ortu').value
    };

    try {
        const action = siswaId ? 'update' : 'create';
        const result = await fetchData(action, 'Siswa', newSiswa);
        showMessage(formMessage, result.message, 'success');
        document.getElementById('siswa-form-container').classList.add('hidden'); // Hide form
        await fetchAndRenderSiswa(); // Refresh list
    } catch (error) {
        showMessage(formMessage, error.message);
    }
};

const fetchAndRenderSiswa = async () => {
    const siswaListContainer = document.getElementById('siswa-list-container');
    siswaListContainer.innerHTML = '<p class="text-center"><i class="fas fa-spinner fa-spin"></i> Memuat data siswa...</p>';
    try {
        const result = await fetchData('read', 'Siswa');
        if (result.data.length > 0) {
            let tableHtml = `
                <h3><i class="fas fa-list"></i> Daftar Siswa</h3>
                <table>
                    <thead>
                        <tr>
                            <th>NIS</th>
                            <th>Nama Lengkap</th>
                            <th>Kelas</th>
                            <th>Jenis Kelamin</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            result.data.forEach(siswa => {
                tableHtml += `
                    <tr>
                        <td data-label="NIS">${siswa.NIS}</td>
                        <td data-label="Nama Lengkap">${siswa.Nama_Lengkap}</td>
                        <td data-label="Kelas">${siswa.Kelas}</td>
                        <td data-label="Jenis Kelamin">${siswa.Jenis_Kelamin}</td>
                        <td data-label="Aksi">
                            <button class="btn btn-secondary btn-small edit-siswa-btn" data-id="${siswa.ID_Siswa}"><i class="fas fa-edit"></i> Edit</button>
                            <button class="btn btn-danger btn-small delete-siswa-btn" data-id="${siswa.ID_Siswa}"><i class="fas fa-trash-alt"></i> Hapus</button>
                        </td>
                    </tr>
                `;
            });
            tableHtml += `</tbody></table>`;
            siswaListContainer.innerHTML = tableHtml;

            siswaListContainer.querySelectorAll('.edit-siswa-btn').forEach(button => {
                button.addEventListener('click', (e) => editSiswa(e.currentTarget.dataset.id, result.data));
            });
            siswaListContainer.querySelectorAll('.delete-siswa-btn').forEach(button => {
                button.addEventListener('click', (e) => deleteSiswa(e.currentTarget.dataset.id));
            });
        } else {
            siswaListContainer.innerHTML = '<p class="message info">Belum ada data siswa. Silakan tambahkan atau impor.</p>';
        }
    } catch (error) {
        siswaListContainer.innerHTML = `<p class="message error">${error.message}</p>`;
    }
};

const editSiswa = (id, allSiswaData) => {
    const siswaToEdit = allSiswaData.find(s => s.ID_Siswa === id);
    if (siswaToEdit) {
        showAddSiswaForm(siswaToEdit); // Pass data to form for editing
    } else {
        alert('Siswa tidak ditemukan.');
    }
};

const deleteSiswa = async (id) => {
    if (confirm(`Apakah Anda yakin ingin menghapus siswa dengan ID: ${id}?`)) {
        try {
            const result = await fetchData('delete', 'Siswa', { ID_Siswa: id });
            alert(result.message);
            await fetchAndRenderSiswa();
        } catch (error) {
            alert(error.message);
        }
    }
};

const handleImportSiswa = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = file.name;
    const fileExtension = fileName.split('.').pop().toLowerCase();

    const reader = new FileReader();
    reader.onload = async (event) => {
        const data = event.target.result;
        let records = [];

        try {
            if (fileExtension === 'csv') {
                records = Papa.parse(data, { header: true }).data;
            } else if (fileExtension === 'xlsx') {
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
            } else {
                alert('Format file tidak didukung. Mohon gunakan .csv atau .xlsx');
                return;
            }

            // Map imported headers to sheet headers if necessary
            // Assume column names in file loosely match Google Sheet headers
            records = records.map(record => ({
                ID_Siswa: record.NIS || 'SIS_' + Date.now() + Math.random().toString(36).substring(2, 8), // Unique ID
                Nama_Lengkap: record['Nama Lengkap'] || record['Nama_Lengkap'] || '',
                NIS: record.NIS || '',
                Kelas: record.Kelas || '',
                Jenis_Kelamin: record['Jenis Kelamin'] || record['Jenis_Kelamin'] || '',
                Tanggal_Lahir: record['Tanggal Lahir'] || record['Tanggal_Lahir'] || '',
                Alamat: record.Alamat || '',
                Nomor_Telepon_Ortu: record['Nomor Telepon Ortu'] || record['Nomor_Telepon_Ortu'] || ''
            }));

            const result = await fetchData('bulkCreate', 'Siswa', { records: records });
            alert(result.message);
            await fetchAndRenderSiswa();
        } catch (error) {
            alert('Gagal mengimpor data: ' + error.message);
            console.error('Import error:', error);
        } finally {
            e.target.value = ''; // Clear file input
        }
    };

    if (fileExtension === 'csv') {
        reader.readAsText(file);
    } else if (fileExtension === 'xlsx') {
        reader.readAsBinaryString(file);
    }
};

const exportSiswaData = async () => {
    try {
        const result = await fetchData('read', 'Siswa');
        if (result.data.length === 0) {
            alert('Tidak ada data siswa untuk diekspor.');
            return;
        }

        const headers = Object.keys(result.data[0]);
        const data = [headers, ...result.data.map(row => headers.map(header => row[header]))];

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Siswa");
        XLSX.writeFile(wb, "Data_Siswa_SMK.xlsx");
        alert('Data siswa berhasil diekspor sebagai Data_Siswa_SMK.xlsx');

    } catch (error) {
        alert('Gagal mengekspor data: ' + error.message);
    }
};

const loadAbsensiInput = async () => {
    renderPage(`
        <h2><i class="fas fa-calendar-check"></i> Absensi Harian</h2>
        <form id="absensi-form" class="card">
            <h3>Input Absensi</h3>
            <div class="form-group">
                <label for="absensi-tanggal"><i class="fas fa-calendar-alt"></i> Tanggal Absensi</label>
                <input type="date" id="absensi-tanggal" value="${new Date().toISOString().slice(0, 10)}" required>
            </div>
            <div id="absensi-siswa-list">
                <p class="text-center"><i class="fas fa-spinner fa-spin"></i> Memuat daftar siswa...</p>
            </div>
            <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Simpan Absensi</button>
            <p id="absensi-form-message" class="message hidden"></p>
        </form>

        <section id="rekap-absensi-section" class="card">
            <h3><i class="fas fa-chart-bar"></i> Rekapitulasi Absensi</h3>
            <div class="form-group">
                <label for="rekap-absensi-month">Pilih Bulan</label>
                <input type="month" id="rekap-absensi-month" value="${new Date().toISOString().slice(0, 7)}">
            </div>
            <button id="show-rekap-absensi-btn" class="btn btn-secondary"><i class="fas fa-eye"></i> Tampilkan Rekap Absensi</button>
            <div id="rekap-absensi-result" class="data-table-container"></div>
            <div class="btn-group">
                <button id="export-absensi-pdf-btn" class="btn btn-secondary hidden"><i class="fas fa-file-pdf"></i> Ekspor PDF</button>
                <button id="export-absensi-excel-btn" class="btn btn-secondary hidden"><i class="fas fa-file-excel"></i> Ekspor Excel</button>
            </div>
        </section>
    `);

    const absensiSiswaListDiv = document.getElementById('absensi-siswa-list');
    const absensiForm = document.getElementById('absensi-form');
    const showRekapAbsensiBtn = document.getElementById('show-rekap-absensi-btn');
    const rekapAbsensiResultDiv = document.getElementById('rekap-absensi-result');
    const rekapAbsensiMonthInput = document.getElementById('rekap-absensi-month');
    const exportAbsensiPdfBtn = document.getElementById('export-absensi-pdf-btn');
    const exportAbsensiExcelBtn = document.getElementById('export-absensi-excel-btn');

    // Populate student list for attendance
    try {
        const siswaResult = await fetchData('read', 'Siswa');
        if (siswaResult.data.length > 0) {
            let siswaAbsenHtml = '<div class="absensi-grid">'; // Use CSS grid for better layout
            siswaResult.data.forEach(siswa => {
                siswaAbsenHtml += `
                    <div class="absensi-item">
                        <span class="siswa-name">${siswa.Nama_Lengkap} (${siswa.Kelas})</span>
                        <select data-siswa-id="${siswa.ID_Siswa}" class="absensi-status">
                            <option value="Hadir">Hadir</option>
                            <option value="Sakit">Sakit</option>
                            <option value="Izin">Izin</option>
                            <option value="Alpha">Alpha</option>
                        </select>
                    </div>
                `;
            });
            siswaAbsenHtml += '</div>';
            absensiSiswaListDiv.innerHTML = siswaAbsenHtml;
        } else {
            absensiSiswaListDiv.innerHTML = '<p class="message info">Tidak ada data siswa. Silakan tambahkan siswa terlebih dahulu.</p>';
        }
    } catch (error) {
        absensiSiswaListDiv.innerHTML = `<p class="message error">${error.message}</p>`;
    }

    absensiForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const absensiFormMessage = document.getElementById('absensi-form-message');
        clearMessage(absensiFormMessage);

        const tanggal = document.getElementById('absensi-tanggal').value;
        const absensiRecords = [];
        document.querySelectorAll('.absensi-status').forEach(select => {
            absensiRecords.push({
                ID_Siswa: select.dataset.siswaId,
                Tanggal: tanggal,
                Status_Kehadiran: select.value,
                Keterangan: '' // Could add an input for notes here
            });
        });

        try {
            const result = await fetchData('inputAbsensi', 'Absensi', { absensiRecords });
            showMessage(absensiFormMessage, result.message, 'success');
            // Optionally clear selections or refresh current month rekap
        } catch (error) {
            showMessage(absensiFormMessage, error.message);
        }
    });

    const fetchAndRenderRekapAbsensi = async () => {
        rekapAbsensiResultDiv.innerHTML = '<p class="text-center"><i class="fas fa-spinner fa-spin"></i> Memuat rekap absensi...</p>';
        exportAbsensiPdfBtn.classList.add('hidden');
        exportAbsensiExcelBtn.classList.add('hidden');
        try {
            const selectedMonth = rekapAbsensiMonthInput.value; // YYYY-MM
            const result = await fetchData('getRekapAbsensi', 'Absensi', { filter: { month: selectedMonth } });

            if (result.data.length > 0) {
                let rekapHtml = `
                    <h4>Rekap Absensi Bulan ${selectedMonth}</h4>
                    <table>
                        <thead>
                            <tr>
                                <th>Nama Siswa</th>
                                <th>Kelas</th>
                                <th>Hadir</th>
                                <th>Sakit</th>
                                <th>Izin</th>
                                <th>Alpha</th>
                                <th>Total Hari</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                result.data.forEach(rekap => {
                    rekapHtml += `
                        <tr>
                            <td data-label="Nama Siswa">${rekap.Nama_Lengkap}</td>
                            <td data-label="Kelas">${rekap.Kelas}</td>
                            <td data-label="Hadir">${rekap.Hadir}</td>
                            <td data-label="Sakit">${rekap.Sakit}</td>
                            <td data-label="Izin">${rekap.Izin}</td>
                            <td data-label="Alpha">${rekap.Alpha}</td>
                            <td data-label="Total Hari">${rekap.Total}</td>
                        </tr>
                    `;
                });
                rekapHtml += `</tbody></table>`;
                rekapAbsensiResultDiv.innerHTML = rekapHtml;
                exportAbsensiPdfBtn.classList.remove('hidden');
                exportAbsensiExcelBtn.classList.remove('hidden');
            } else {
                rekapAbsensiResultDiv.innerHTML = '<p class="message info">Belum ada rekap absensi untuk bulan ini.</p>';
            }
        } catch (error) {
            rekapAbsensiResultDiv.innerHTML = `<p class="message error">${error.message}</p>`;
        }
    };

    showRekapAbsensiBtn.addEventListener('click', fetchAndRenderRekapAbsensi);
    fetchAndRenderRekapAbsensi(); // Initial load for current month

    exportAbsensiPdfBtn.addEventListener('click', () => alert('Fungsi ekspor PDF absensi belum diimplementasikan sepenuhnya.'));
    exportAbsensiExcelBtn.addEventListener('click', () => alert('Fungsi ekspor Excel absensi belum diimplementasikan sepenuhnya.'));
};


const loadPenilaianInput = async () => {
    renderPage(`
        <h2><i class="fas fa-clipboard-list"></i> Penilaian Siswa</h2>
        <form id="nilai-form" class="card">
            <h3>Input Nilai</h3>
            <div class="form-group">
                <label for="nilai-siswa-select"><i class="fas fa-user-graduate"></i> Pilih Siswa</label>
                <select id="nilai-siswa-select" required>
                    <option value="">-- Pilih Siswa --</option>
                </select>
            </div>
            <div class="form-group">
                <label for="mata-pelajaran-select"><i class="fas fa-book"></i> Mata Pelajaran</label>
                <select id="mata-pelajaran-select" required>
                    <option value="">-- Pilih Mata Pelajaran --</option>
                </select>
            </div>
            <div class="form-group">
                <label for="kategori-nilai"><i class="fas fa-tag"></i> Kategori Nilai</label>
                <select id="kategori-nilai">
                    <option value="Tugas1">Tugas 1</option>
                    <option value="Tugas2">Tugas 2</option>
                    <option value="Tugas3">Tugas 3</option>
                    <option value="UTS">UTS</option>
                    <option value="UAS">UAS</option>
                    <option value="UH1">Ulangan Harian 1</option>
                    <option value="UH2">Ulangan Harian 2</option>
                    <option value="Proyek">Proyek</option>
                </select>
            </div>
            <div class="form-group">
                <label for="input-nilai"><i class="fas fa-percentage"></i> Nilai</label>
                <input type="number" id="input-nilai" min="0" max="100" placeholder="0-100" required>
            </div>
            <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Simpan Nilai</button>
            <p id="nilai-form-message" class="message hidden"></p>
        </form>

        <section id="rekap-nilai-section" class="card">
            <h3><i class="fas fa-chart-line"></i> Rekapitulasi Nilai</h3>
            <div class="form-group">
                <label for="rekap-nilai-siswa-select">Pilih Siswa</label>
                <select id="rekap-nilai-siswa-select">
                    <option value="">-- Semua Siswa --</option>
                </select>
            </div>
            <div class="form-group">
                <label for="rekap-nilai-mapel-select">Pilih Mata Pelajaran</label>
                <select id="rekap-nilai-mapel-select">
                    <option value="">-- Semua Mata Pelajaran --</option>
                </select>
            </div>
            <button id="show-rekap-nilai-btn" class="btn btn-secondary"><i class="fas fa-eye"></i> Tampilkan Rekap Nilai</button>
            <div id="rekap-nilai-result" class="data-table-container"></div>
        </section>
    `);

    const nilaiSiswaSelect = document.getElementById('nilai-siswa-select');
    const mataPelajaranSelect = document.getElementById('mata-pelajaran-select');
    const nilaiForm = document.getElementById('nilai-form');
    const showRekapNilaiBtn = document.getElementById('show-rekap-nilai-btn');
    const rekapNilaiResultDiv = document.getElementById('rekap-nilai-result');
    const rekapNilaiSiswaSelect = document.getElementById('rekap-nilai-siswa-select');
    const rekapNilaiMapelSelect = document.getElementById('rekap-nilai-mapel-select');

    // Populate student and subject dropdowns
    try {
        const siswaResult = await fetchData('read', 'Siswa');
        if (siswaResult.data.length > 0) {
            siswaResult.data.forEach(siswa => {
                const option1 = document.createElement('option');
                option1.value = siswa.ID_Siswa;
                option1.textContent = `${siswa.Nama_Lengkap} (${siswa.Kelas})`;
                nilaiSiswaSelect.appendChild(option1);

                const option2 = option1.cloneNode(true); // Clone for rekap select
                rekapNilaiSiswaSelect.appendChild(option2);
            });
        }

        const subjects = appConfig.SUBJECTS ? appConfig.SUBJECTS.split(',') : [];
        subjects.forEach(subject => {
            const option1 = document.createElement('option');
            option1.value = subject;
            option1.textContent = subject;
            mataPelajaranSelect.appendChild(option1);

            const option2 = option1.cloneNode(true); // Clone for rekap select
            rekapNilaiMapelSelect.appendChild(option2);
        });

    } catch (error) {
        alert('Gagal memuat data siswa/mapel: ' + error.message);
    }

    nilaiForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nilaiFormMessage = document.getElementById('nilai-form-message');
        clearMessage(nilaiFormMessage);

        const nilaiRecord = {
            ID_Siswa: nilaiSiswaSelect.value,
            Mata_Pelajaran: mataPelajaranSelect.value,
            Kategori_Nilai: document.getElementById('kategori-nilai').value,
            Nilai: parseFloat(document.getElementById('input-nilai').value),
            Tanggal_Input: new Date().toISOString().slice(0, 10)
        };

        try {
            const result = await fetchData('inputNilai', 'Nilai', { nilaiRecord });
            showMessage(nilaiFormMessage, result.message, 'success');
            // Clear form or update rekap if needed
        } catch (error) {
            showMessage(nilaiFormMessage, error.message);
        }
    });

    const fetchAndRenderRekapNilai = async () => {
        rekapNilaiResultDiv.innerHTML = '<p class="text-center"><i class="fas fa-spinner fa-spin"></i> Memuat rekap nilai...</p>';
        try {
            const filter = {
                ID_Siswa: rekapNilaiSiswaSelect.value,
                Mata_Pelajaran: rekapNilaiMapelSelect.value
            };
            const result = await fetchData('getRekapNilai', 'Nilai', { filter });

            if (result.data.length > 0) {
                let rekapHtml = `
                    <h4>Rekap Nilai</h4>
                    <table>
                        <thead>
                            <tr>
                                <th>Nama Siswa</th>
                                <th>Kelas</th>
                                <th>Mata Pelajaran</th>
                                <th>Rata-rata Nilai</th>
                                <th>Status KKM</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                result.data.forEach(rekap => {
                    const statusClass = rekap.Status_KKM === 'Lulus' ? 'status-success' : 'status-fail';
                    rekapHtml += `
                        <tr>
                            <td data-label="Nama Siswa">${rekap.Nama_Lengkap}</td>
                            <td data-label="Kelas">${rekap.Kelas}</td>
                            <td data-label="Mata Pelajaran">${rekap.Mata_Pelajaran}</td>
                            <td data-label="Rata-rata Nilai">${rekap.Rata_Rata_Nilai}</td>
                            <td data-label="Status KKM"><span class="${statusClass}">${rekap.Status_KKM}</span></td>
                        </tr>
                    `;
                });
                rekapHtml += `</tbody></table>`;
                rekapNilaiResultDiv.innerHTML = rekapHtml;
            } else {
                rekapNilaiResultDiv.innerHTML = '<p class="message info">Belum ada rekap nilai untuk filter ini.</p>';
            }
        } catch (error) {
            rekapNilaiResultDiv.innerHTML = `<p class="message error">${error.message}</p>`;
        }
    };

    showRekapNilaiBtn.addEventListener('click', fetchAndRenderRekapNilai);
    fetchAndRenderRekapNilai(); // Initial load
};

const loadRekapLaporan = () => {
    renderPage(`
        <h2><i class="fas fa-file-alt"></i> Rekap Laporan & Rapor</h2>
        <section class="card">
            <h3>Cetak Rapor Sementara</h3>
            <div class="form-group">
                <label for="rapor-siswa-select">Pilih Siswa</label>
                <select id="rapor-siswa-select">
                    <option value="">-- Pilih Siswa --</option>
                </select>
            </div>
            <button id="generate-rapor-btn" class="btn btn-primary"><i class="fas fa-print"></i> Cetak Rapor</button>
            <div id="rapor-preview" class="message hidden"></div>
            <p class="info-text message info">Fitur cetak rapor PDF memerlukan integrasi lebih lanjut dengan Google Docs API di Apps Script. Saat ini, hanya placeholder.</p>
        </section>

        <section class="card">
            <h3>Grafik Perkembangan Nilai Siswa</h3>
            <div class="form-group">
                <label for="chart-siswa-select">Pilih Siswa</label>
                <select id="chart-siswa-select">
                    <option value="">-- Pilih Siswa --</option>
                </select>
            </div>
            <div class="form-group">
                <label for="chart-mapel-select">Pilih Mata Pelajaran</label>
                <select id="chart-mapel-select">
                    <option value="">-- Semua Mata Pelajaran --</option>
                </select>
            </div>
            <button id="show-nilai-chart-btn" class="btn btn-secondary"><i class="fas fa-chart-line"></i> Tampilkan Grafik</button>
            <div class="chart-container" style="height: 400px; margin-top: 20px;">
                <canvas id="nilaiPerkembanganChart"></canvas>
            </div>
        </section>
    `);

    const raporSiswaSelect = document.getElementById('rapor-siswa-select');
    const generateRaporBtn = document.getElementById('generate-rapor-btn');
    const raporPreviewDiv = document.getElementById('rapor-preview');
    const chartSiswaSelect = document.getElementById('chart-siswa-select');
    const chartMapelSelect = document.getElementById('chart-mapel-select');
    const showNilaiChartBtn = document.getElementById('show-nilai-chart-btn');
    let nilaiPerkembanganChart; // To hold the Chart.js instance

    // Populate siswa and mapel dropdowns
    const populateDropdowns = async () => {
        try {
            const siswaResult = await fetchData('read', 'Siswa');
            if (siswaResult.data.length > 0) {
                siswaResult.data.forEach(siswa => {
                    const optionRapor = document.createElement('option');
                    optionRapor.value = siswa.ID_Siswa;
                    optionRapor.textContent = `${siswa.Nama_Lengkap} (${siswa.Kelas})`;
                    raporSiswaSelect.appendChild(optionRapor);

                    const optionChart = optionRapor.cloneNode(true);
                    chartSiswaSelect.appendChild(optionChart);
                });
            }

            const subjects = appConfig.SUBJECTS ? appConfig.SUBJECTS.split(',') : [];
            subjects.forEach(subject => {
                const optionChartMapel = document.createElement('option');
                optionChartMapel.value = subject;
                optionChartMapel.textContent = subject;
                chartMapelSelect.appendChild(optionChartMapel);
            });
        } catch (error) {
            console.error('Error populating dropdowns:', error);
        }
    };
    populateDropdowns();

    generateRaporBtn.addEventListener('click', () => {
        const selectedSiswaId = raporSiswaSelect.value;
        if (!selectedSiswaId) {
            showMessage(raporPreviewDiv, 'Pilih siswa untuk mencetak rapor.', 'error');
            return;
        }
        showMessage(raporPreviewDiv, 'Fungsi ini akan memanggil Apps Script untuk membuat PDF rapor.', 'info');
        // Actual implementation would call an Apps Script function to generate PDF
        // e.g., fetchData('generateRaporPDF', null, { ID_Siswa: selectedSiswaId });
    });

    showNilaiChartBtn.addEventListener('click', async () => {
        const selectedSiswaId = chartSiswaSelect.value;
        const selectedMapel = chartMapelSelect.value;

        if (!selectedSiswaId) {
            alert('Pilih siswa untuk menampilkan grafik.');
            return;
        }

        try {
            const result = await fetchData('getRekapNilai', 'Nilai', { filter: { ID_Siswa: selectedSiswaId } });
            if (result.data && result.data.length > 0) {
                const filteredData = result.data.filter(d =>
                    (selectedMapel === '' || d.Mata_Pelajaran === selectedMapel) && String(d.ID_Siswa) === String(selectedSiswaId)
                );

                if (filteredData.length === 0) {
                    alert('Tidak ada data nilai untuk siswa dan mata pelajaran yang dipilih.');
                    return;
                }

                // Prepare data for Chart.js
                // Group by Mata Pelajaran to show average per subject, or show individual scores
                const chartLabels = [];
                const chartDataPoints = [];

                if (selectedMapel) {
                    // Show individual scores if specific subject selected (assuming more categories available)
                    const studentAllNilaiResult = await fetchData('read', 'Nilai');
                    const studentSpecificNilai = studentAllNilaiResult.data.filter(n =>
                        String(n.ID_Siswa) === String(selectedSiswaId) && String(n.Mata_Pelajaran) === String(selectedMapel)
                    ).sort((a, b) => new Date(a.Tanggal_Input) - new Date(b.Tanggal_Input)); // Sort by date

                    if (studentSpecificNilai.length > 0) {
                        studentSpecificNilai.forEach(n => {
                            chartLabels.push(`${n.Kategori_Nilai} (${n.Tanggal_Input})`);
                            chartDataPoints.push(parseFloat(n.Nilai));
                        });
                    } else {
                        alert('Tidak ada nilai detail untuk mata pelajaran ini.');
                        return;
                    }

                } else {
                    // Show average per subject for the student
                    filteredData.forEach(d => {
                        chartLabels.push(d.Mata_Pelajaran);
                        chartDataPoints.push(parseFloat(d.Rata_Rata_Nilai));
                    });
                }


                if (nilaiPerkembanganChart) {
                    nilaiPerkembanganChart.destroy(); // Destroy previous chart instance
                }

                const ctx = document.getElementById('nilaiPerkembanganChart').getContext('2d');
                nilaiPerkembanganChart = new Chart(ctx, {
                    type: 'bar', // Bar chart might be better for averages per subject
                    data: {
                        labels: chartLabels,
                        datasets: [{
                            label: `Nilai ${chartSiswaSelect.options[chartSiswaSelect.selectedIndex].text} (${selectedMapel || 'Semua Mapel'})`,
                            data: chartDataPoints,
                            backgroundColor: selectedMapel ? 'rgba(0, 123, 255, 0.6)' : 'rgba(40, 167, 69, 0.6)', // Different color if specific subject
                            borderColor: selectedMapel ? 'rgba(0, 123, 255, 1)' : 'rgba(40, 167, 69, 1)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 100,
                                title: {
                                    display: true,
                                    text: 'Nilai'
                                }
                            },
                            x: {
                                title: {
                                    display: true,
                                    text: selectedMapel ? 'Kategori Nilai (Tanggal)' : 'Mata Pelajaran'
                                }
                            }
                        },
                        plugins: {
                            legend: {
                                display: false
                            }
                        }
                    }
                });
            } else {
                alert('Tidak ada data nilai untuk siswa ini.');
            }
        } catch (error) {
            alert('Gagal memuat data grafik: ' + error.message);
            console.error(error);
        }
    });
};

const loadUserManagement = async () => {
    if (currentUserRole !== 'Admin') {
        renderPage(`<p class="message error">Anda tidak memiliki akses ke halaman ini. Hanya Admin yang dapat mengakses manajemen pengguna.</p>`);
        return;
    }
    renderPage(`
        <h2><i class="fas fa-user-shield"></i> User Management</h2>
        <button id="add-user-btn" class="btn btn-primary"><i class="fas fa-user-plus"></i> Tambah User Baru</button>
        <div id="user-form-container" class="card hidden"></div>
        <div id="user-list-container" class="data-table-container card"></div>
    `);

    document.getElementById('add-user-btn').addEventListener('click', showAddUserForm);
    await fetchAndRenderUsers();
};

const showAddUserForm = () => {
    const formContainer = document.getElementById('user-form-container');
    formContainer.classList.remove('hidden');
    formContainer.innerHTML = `
        <h3><i class="fas fa-plus-circle"></i> Form Tambah User</h3>
        <form id="add-user-form">
            <div class="form-group">
                <label for="user-username">Username</label>
                <input type="text" id="user-username" required>
            </div>
            <div class="form-group">
                <label for="user-password">Password</label>
                <input type="password" id="user-password" required>
            </div>
            <div class="form-group">
                <label for="user-role">Role</label>
                <select id="user-role">
                    <option value="Guru">Guru</option>
                    <option value="Admin">Admin</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Simpan User</button>
            <button type="button" class="btn btn-secondary" id="cancel-user-add"><i class="fas fa-times"></i> Batal</button>
        </form>
        <p id="user-form-message" class="message hidden"></p>
    `;
    document.getElementById('add-user-form').addEventListener('submit', handleAddUserFormSubmit);
    document.getElementById('cancel-user-add').addEventListener('click', () => formContainer.classList.add('hidden'));
};

const handleAddUserFormSubmit = async (e) => {
    e.preventDefault();
    const formMessage = document.getElementById('user-form-message');
    clearMessage(formMessage);

    const newUser = {
        username: document.getElementById('user-username').value,
        password: document.getElementById('user-password').value, // In real app, hash this before sending
        Role: document.getElementById('user-role').value
    };

    try {
        const result = await fetchData('createUser', 'Users', newUser);
        showMessage(formMessage, result.message, 'success');
        document.getElementById('user-form-container').classList.add('hidden');
        await fetchAndRenderUsers();
    } catch (error) {
        showMessage(formMessage, error.message);
    }
};

const fetchAndRenderUsers = async () => {
    const userListContainer = document.getElementById('user-list-container');
    userListContainer.innerHTML = '<p class="text-center"><i class="fas fa-spinner fa-spin"></i> Memuat data user...</p>';
    try {
        const result = await fetchData('read', 'Users');
        if (result.data.length > 0) {
            let tableHtml = `
                <h3><i class="fas fa-list"></i> Daftar User</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Role</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            result.data.forEach(user => {
                tableHtml += `
                    <tr>
                        <td data-label="Username">${user.Username}</td>
                        <td data-label="Role">${user.Role}</td>
                        <td data-label="Aksi">
                            <button class="btn btn-danger btn-small delete-user-btn" data-id="${user.ID_User}"><i class="fas fa-trash-alt"></i> Hapus</button>
                        </td>
                    </tr>
                `;
            });
            tableHtml += `</tbody></table>`;
            userListContainer.innerHTML = tableHtml;

            userListContainer.querySelectorAll('.delete-user-btn').forEach(button => {
                button.addEventListener('click', (e) => deleteUser(e.currentTarget.dataset.id));
            });
        } else {
            userListContainer.innerHTML = '<p class="message info">Belum ada user. Silakan tambahkan user baru.</p>';
        }
    } catch (error) {
        userListContainer.innerHTML = `<p class="message error">${error.message}</p>`;
    }
};

const deleteUser = async (id) => {
    if (confirm(`Apakah Anda yakin ingin menghapus user dengan ID: ${id}?`)) {
        try {
            const result = await fetchData('delete', 'Users', { ID_User: id });
            alert(result.message);
            await fetchAndRenderUsers();
        } catch (error) {
            alert(error.message);
        }
    }
};


// --- NEW FEATURE: Student Report Access ---
const loadStudentReportAccess = () => {
    renderPage(`
        <h2><i class="fas fa-file-contract"></i> Laporan Pribadi Siswa</h2>
        <section id="student-report-input" class="card">
            <h3>Cari Laporan Anda</h3>
            <div class="form-group">
                <label for="student-name-input"><i class="fas fa-user"></i> Masukkan Nama Lengkap Anda</label>
                <input type="text" id="student-name-input" placeholder="Contoh: Budi Santoso" required>
            </div>
            <button id="find-student-report-btn" class="btn btn-primary"><i class="fas fa-search"></i> Cari Laporan</button>
            <p id="student-report-message" class="message hidden"></p>
        </section>

        <section id="student-report-display" class="card hidden">
            <h3 id="report-title"><i class="fas fa-file-invoice"></i> Laporan Pribadi</h3>
            <div class="student-report-info">
                <p>Nama: <span id="report-student-name"></span></p>
                <p>NIS: <span id="report-student-nis"></span></p>
                <p>Kelas: <span id="report-student-kelas"></span></p>
            </div>

            <div id="absensi-summary-section">
                <h4>Rekap Absensi Bulan Ini</h4>
                <div class="absensi-rekap-summary" id="absensi-summary-container">
                    </div>
            </div>

            <div id="nilai-report-section">
                <h4>Rekap Nilai</h4>
                <div id="nilai-report-table" class="data-table-container">
                    </div>
            </div>
            <div class="btn-group">
                 <button id="print-report-btn" class="btn btn-secondary"><i class="fas fa-print"></i> Cetak Laporan</button>
            </div>
        </section>
    `);

    const studentNameInput = document.getElementById('student-name-input');
    const findStudentReportBtn = document.getElementById('find-student-report-btn');
    const studentReportMessage = document.getElementById('student-report-message');
    const studentReportDisplay = document.getElementById('student-report-display');
    const reportStudentName = document.getElementById('report-student-name');
    const reportStudentNis = document.getElementById('report-student-nis');
    const reportStudentKelas = document.getElementById('report-student-kelas');
    const absensiSummaryContainer = document.getElementById('absensi-summary-container');
    const nilaiReportTable = document.getElementById('nilai-report-table');
    const printReportBtn = document.getElementById('print-report-btn');


    findStudentReportBtn.addEventListener('click', async () => {
        clearMessage(studentReportMessage);
        studentReportDisplay.classList.add('hidden'); // Hide previous report
        const studentName = studentNameInput.value.trim();

        if (!studentName) {
            showMessage(studentReportMessage, 'Mohon masukkan nama lengkap Anda.', 'error');
            return;
        }

        try {
            const result = await fetchData('getStudentReport', null, { filter: { studentName: studentName } });

            if (result.status === 'success') {
                if (result.message && result.message.includes('Ditemukan lebih dari satu siswa')) {
                    let specificityMsg = result.message + '<br>Mohon lebih spesifik, misalnya sertakan kelas atau bagian nama lengkap yang lebih unik.';
                    if (result.matchedStudents && result.matchedStudents.length > 0) {
                        specificityMsg += '<br>Ditemukan: ' + result.matchedStudents.map(s => `${s.Nama_Lengkap} (${s.Kelas})`).join(', ');
                    }
                    showMessage(studentReportMessage, specificityMsg, 'info');
                    return;
                }
                if (!result.studentReport) {
                    showMessage(studentReportMessage, result.message || 'Siswa tidak ditemukan dengan nama tersebut.', 'error');
                    return;
                }

                const report = result.studentReport;
                reportStudentName.textContent = report.studentInfo.Nama_Lengkap;
                reportStudentNis.textContent = report.studentInfo.NIS;
                reportStudentKelas.textContent = report.studentInfo.Kelas;

                // Render Absensi Summary
                absensiSummaryContainer.innerHTML = `
                    <div class="absensi-rekap-item"><div class="value">${report.absensiReport.Hadir}</div><div class="label">Hadir</div></div>
                    <div class="absensi-rekap-item"><div class="value">${report.absensiReport.Sakit}</div><div class="label">Sakit</div></div>
                    <div class="absensi-rekap-item"><div class="value">${report.absensiReport.Izin}</div><div class="label">Izin</div></div>
                    <div class="absensi-rekap-item"><div class="value">${report.absensiReport.Alpha}</div><div class="label">Alpha</div></div>
                    <div class="absensi-rekap-item"><div class="value">${report.absensiReport.Total}</div><div class="label">Total Hari</div></div>
                `;

                // Render Nilai Report Table
                if (report.nilaiReport && report.nilaiReport.length > 0) {
                    let nilaiTableHtml = `
                        <table>
                            <thead>
                                <tr>
                                    <th>Mata Pelajaran</th>
                                    <th>Rata-rata Nilai</th>
                                    <th>Status KKM</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;
                    report.nilaiReport.forEach(nilai => {
                        const statusClass = nilai.Status_KKM === 'Lulus' ? 'status-success' : 'status-fail';
                        nilaiTableHtml += `
                            <tr>
                                <td data-label="Mata Pelajaran">${nilai.Mata_Pelajaran}</td>
                                <td data-label="Rata-rata Nilai">${nilai.Rata_Rata_Nilai}</td>
                                <td data-label="Status KKM"><span class="${statusClass}">${nilai.Status_KKM}</span></td>
                            </tr>
                        `;
                    });
                    nilaiTableHtml += `</tbody></table>`;
                    nilaiReportTable.innerHTML = nilaiTableHtml;
                } else {
                    nilaiReportTable.innerHTML = '<p class="message info">Belum ada data nilai untuk Anda.</p>';
                }

                studentReportDisplay.classList.remove('hidden'); // Show the report
                showMessage(studentReportMessage, 'Laporan Anda berhasil dimuat!', 'success');

            } else {
                showMessage(studentReportMessage, result.message, 'error');
            }
        } catch (error) {
            showMessage(studentReportMessage, error.message);
            console.error('Error fetching student report:', error);
        }
    });

    printReportBtn.addEventListener('click', () => {
        const printContent = document.getElementById('student-report-display').innerHTML;
        const originalContent = document.body.innerHTML;

        // Create a new window for printing to isolate CSS
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Laporan Siswa - ${reportStudentName.textContent}</title>
                <link rel="stylesheet" href="css/style.css">
                <style>
                    /* Minimal styles for print to ensure good layout */
                    body { font-family: 'Poppins', sans-serif; margin: 20px; color: var(--text-color); }
                    .card { box-shadow: none; border: 1px solid var(--border-color); padding: 20px; margin-bottom: 20px; border-radius: 8px; }
                    .btn-group, .hidden, .text-center { display: none !important; } /* Hide buttons and other non-print elements */
                    h2, h3, h4 { color: #333; margin-top: 20px; margin-bottom: 10px; font-weight: 600; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    table th, table td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                    .absensi-rekap-summary { display: flex; flex-wrap: wrap; justify-content: space-around; gap: 10px; margin-bottom: 20px; }
                    .absensi-rekap-item { flex: 1 1 20%; min-width: 100px; padding: 10px; border: 1px solid #eee; border-radius: 5px; text-align: center; }
                    .absensi-rekap-item .value { font-size: 1.5rem; font-weight: 700; color: var(--primary-color); }
                    .absensi-rekap-item .label { font-size: 0.8rem; color: var(--dark-gray); }
                    @media print {
                        body { margin: 0; }
                        .card { page-break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    ${printContent}
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                        window.onafterprint = function() {
                            window.close();
                        };
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    });
};


// --- Initial App Load ---
const initApp = () => {
    DOM.loginForm.addEventListener('submit', handleLogin);
    DOM.logoutBtn.addEventListener('click', handleLogout);

    DOM.mainNav.addEventListener('click', (e) => {
        // Find the closest <a> tag that has a data-page attribute
        const targetLink = e.target.closest('a[data-page]');
        if (targetLink) {
            e.preventDefault();
            const page = targetLink.dataset.page;
            // Remove 'active' class from all nav items and add to clicked one
            document.querySelectorAll('#main-nav ul li a').forEach(link => link.classList.remove('active'));
            targetLink.classList.add('active');

            switch (page) {
                case 'dashboard': loadDashboardContent(); break;
                case 'siswa': loadSiswaManagement(); break;
                case 'absensi': loadAbsensiInput(); break;
                case 'penilaian': loadPenilaianInput(); break;
                case 'rekap': loadRekapLaporan(); break;
                case 'users': loadUserManagement(); break;
                case 'student-report-access': loadStudentReportAccess(); break;
            }
        }
    });
};

const loadAppConfig = async () => {
    try {
        const result = await fetchData('readConfig', 'Konfigurasi');
        appConfig = result.data;
        console.log('App Configuration Loaded:', appConfig);
    } catch (error) {
        console.error('Failed to load app configuration:', error);
        alert('Gagal memuat konfigurasi aplikasi. Beberapa fitur mungkin tidak berfungsi dengan baik.');
    }
};

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
