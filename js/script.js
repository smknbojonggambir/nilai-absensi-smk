// Pastikan kode ini berada di dalam file 'script.html' di folder 'js'

document.addEventListener('DOMContentLoaded', () => {
    const appDiv = document.getElementById('app');

    // Fungsi pembantu untuk memanggil fungsi Google Apps Script (backend)
    // Menggunakan fetch API untuk POST request ke fungsi doPost() di Code.gs
    async function callAppsScript(action, sheetName, payload = {}) {
        const url = new URL(location.href);
        url.searchParams.append('action', action);
        if (sheetName) {
            url.searchParams.append('sheetName', sheetName);
        }

        try {
            const response = await fetch(url.toString(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            return await response.json();
        } catch (error) {
            console.error('Error calling Apps Script:', error);
            // Mengembalikan struktur error yang konsisten dengan backend
            return { status: 'error', message: 'Failed to communicate with server: ' + error.message };
        }
    }

    // --- Contoh Implementasi Frontend Sederhana ---
    // (Anda bisa mengganti atau memperluas ini dengan framework seperti Vue/React/Angular)

    function renderLoginPage() {
        appDiv.innerHTML = `
            <h2>Login</h2>
            <p id="loginMessage"></p>
            <label for="username">Username:</label>
            <input type="text" id="username" placeholder="Username">
            <label for="password">Password:</label>
            <input type="password" id="password" placeholder="Password">
            <button id="loginBtn">Login</button>
        `;

        document.getElementById('loginBtn').addEventListener('click', async () => {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const messageElem = document.getElementById('loginMessage');

            messageElem.className = ''; // Reset classes
            messageElem.textContent = 'Logging in...';

            try {
                const result = await callAppsScript('login', 'Users', { username, password });

                if (result.status === 'success') {
                    messageElem.className = 'success-message';
                    messageElem.textContent = `Login berhasil! Peran: ${result.role}`;
                    // Redirect atau tampilkan dashboard sesuai peran
                    setTimeout(() => renderDashboard(result.role), 1000); // Tunda sebentar untuk pesan terlihat
                } else {
                    messageElem.className = 'error-message';
                    messageElem.textContent = result.message;
                }
            } catch (error) {
                messageElem.className = 'error-message';
                messageElem.textContent = 'Error koneksi: ' + error.message;
                console.error('Login error:', error);
            }
        });
    }

    async function renderDashboard(role) {
        appDiv.innerHTML = `
            <h2>Dashboard (${role})</h2>
            <button id="logoutBtn">Logout</button>
            <hr>
            <div id="dashboardContent"></div>
        `;

        document.getElementById('logoutBtn').addEventListener('click', () => {
            renderLoginPage();
        });

        const dashboardContent = document.getElementById('dashboardContent');

        if (role === 'Admin') {
            dashboardContent.innerHTML = `
                <h3>Admin Tools</h3>
                <button id="viewStudentsBtn">Lihat Siswa</button>
                <button id="inputAbsenBtn">Input Absensi</button>
                <button id="inputNilaiBtn">Input Nilai</button>
                <button id="rekapAbsenBtn">Rekap Absensi</button>
                <button id="rekapNilaiBtn">Rekap Nilai</button>
                <button id="createUserBtn">Buat User Baru</button>
                <hr>
                <div id="adminPanel"></div>
            `;
            document.getElementById('viewStudentsBtn').addEventListener('click', () => showData('Siswa', 'Daftar Siswa', 'adminPanel'));
            document.getElementById('inputAbsenBtn').addEventListener('click', renderInputAbsensi);
            document.getElementById('inputNilaiBtn').addEventListener('click', renderInputNilai);
            document.getElementById('rekapAbsenBtn').addEventListener('click', () => renderRekapAbsensi());
            document.getElementById('rekapNilaiBtn').addEventListener('click', () => renderRekapNilai());
            document.getElementById('createUserBtn').addEventListener('click', renderCreateUser);

        } else if (role === 'Guru') {
             dashboardContent.innerHTML = `
                <h3>Guru Tools</h3>
                <button id="inputAbsenBtn">Input Absensi</button>
                <button id="inputNilaiBtn">Input Nilai</button>
                <button id="rekapAbsenBtn">Rekap Absensi</button>
                <button id="rekapNilaiBtn">Rekap Nilai</button>
                <hr>
                <div id="guruPanel"></div>
            `;
            document.getElementById('inputAbsenBtn').addEventListener('click', renderInputAbsensi);
            document.getElementById('inputNilaiBtn').addEventListener('click', renderInputNilai);
            document.getElementById('rekapAbsenBtn').addEventListener('click', () => renderRekapAbsensi());
            document.getElementById('rekapNilaiBtn').addEventListener('click', () => renderRekapNilai());
        } else if (role === 'Siswa') {
            dashboardContent.innerHTML = `
                <h3>Laporan Pribadi</h3>
                <p id="studentReportMessage"></p>
                <label for="studentNameSearch">Cari Nama Lengkap Anda:</label>
                <input type="text" id="studentNameSearch" placeholder="Nama Lengkap Anda">
                <button id="searchReportBtn">Lihat Laporan</button>
                <div id="studentReportDisplay"></div>
            `;
            document.getElementById('searchReportBtn').addEventListener('click', async () => {
                const studentName = document.getElementById('studentNameSearch').value;
                const reportDisplay = document.getElementById('studentReportDisplay');
                const messageElem = document.getElementById('studentReportMessage');

                messageElem.className = '';
                messageElem.textContent = '';
                reportDisplay.innerHTML = ''; // Clear previous report

                if (!studentName) {
                    messageElem.className = 'error-message';
                    messageElem.textContent = 'Nama siswa harus diisi.';
                    return;
                }
                
                messageElem.textContent = 'Mencari laporan...';
                try {
                    // Panggil getStudentReport tanpa parameter sheetName (karena fungsi ini mengakses beberapa sheet)
                    const result = await callAppsScript('getStudentReport', null, { studentName });

                    if (result.status === 'success') {
                        if (result.studentReport) {
                            messageElem.className = 'success-message';
                            messageElem.textContent = result.message;
                            
                            // Render Student Info
                            let studentInfoHtml = `
                                <h4>Informasi Siswa:</h4>
                                <p><strong>ID:</strong> ${result.studentReport.studentInfo.ID_Siswa}</p>
                                <p><strong>Nama:</strong> ${result.studentReport.studentInfo.Nama_Lengkap}</p>
                                <p><strong>Kelas:</strong> ${result.studentReport.studentInfo.Kelas}</p>
                            `;

                            // Render Nilai Report
                            let nilaiHtml = '<h4>Rekap Nilai:</h4>';
                            if (result.studentReport.nilaiReport && result.studentReport.nilaiReport.length > 0) {
                                nilaiHtml += `
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Mata Pelajaran</th>
                                                <th>Rata-rata Nilai</th>
                                                <th>Status KKM</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${result.studentReport.nilaiReport.map(n => `
                                                <tr>
                                                    <td>${n.Mata_Pelajaran}</td>
                                                    <td>${n.Rata_Rata_Nilai}</td>
                                                    <td style="color: ${n.Status_KKM === 'Lulus' ? 'green' : 'red'};">${n.Status_KKM}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                `;
                            } else {
                                nilaiHtml += '<p>Belum ada data nilai.</p>';
                            }

                            // Render Absensi Report
                            const absensi = result.studentReport.absensiReport;
                            const currentMonthFormatted = new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' });
                            let absensiHtml = `
                                <h4>Rekap Absensi Bulan Ini (${currentMonthFormatted}):</h4>
                                <p><strong>Hadir:</strong> ${absensi.Hadir}</p>
                                <p><strong>Sakit:</strong> ${absensi.Sakit}</p>
                                <p><strong>Izin:</strong> ${absensi.Izin}</p>
                                <p><strong>Alpha:</strong> ${absensi.Alpha}</p>
                                <p><strong>Total Kehadiran:</strong> ${absensi.Total}</p>
                                <p>(Rekap dihitung berdasarkan kehadiran di bulan ${currentMonthFormatted})</p>
                            `;

                            reportDisplay.innerHTML = studentInfoHtml + nilaiHtml + absensiHtml;

                        } else if (result.matchedStudents && result.matchedStudents.length > 0) {
                            messageElem.className = 'error-message';
                            messageElem.textContent = result.message; // "Ditemukan lebih dari satu siswa..."
                            reportDisplay.innerHTML = `
                                <p>Daftar siswa yang cocok:</p>
                                <ul>
                                    ${result.matchedStudents.map(s => `<li>${s.Nama_Lengkap} (${s.Kelas})</li>`).join('')}
                                </ul>
                                <p>Mohon masukkan nama lengkap yang lebih spesifik.</p>
                            `;
                        } else {
                            messageElem.className = 'error-message';
                            messageElem.textContent = result.message; // "Siswa tidak ditemukan."
                        }
                    } else {
                        messageElem.className = 'error-message';
                        messageElem.textContent = `Error: ${result.message}`;
                    }
                } catch (error) {
                    messageElem.className = 'error-message';
                    messageElem.textContent = `Error memuat laporan: ${error.message}`;
                    console.error('Error getting student report:', error);
                }
            });
        }
    }

    // Fungsi untuk menampilkan data dari sheet tertentu dalam bentuk tabel
    async function showData(sheetName, title, panelId) {
        const panel = document.getElementById(panelId);
        panel.innerHTML = `<h3>${title}</h3><p>Memuat data...</p>`;
        try {
            const data = await callAppsScript('read', sheetName);
            let tableHtml = '';
            if (data.length > 0) {
                tableHtml += `<table><thead><tr>`;
                Object.keys(data[0]).forEach(header => {
                    tableHtml += `<th>${header}</th>`;
                });
                tableHtml += `</tr></thead><tbody>`;
                data.forEach(row => {
                    tableHtml += `<tr>`;
                    Object.values(row).forEach(cell => {
                        tableHtml += `<td>${cell}</td>`;
                    });
                    tableHtml += `</tr>`;
                });
                tableHtml += `</tbody></table>`;
            } else {
                tableHtml = '<p>Tidak ada data untuk ditampilkan.</p>';
            }
            panel.innerHTML = tableHtml;
        } catch (error) {
            panel.innerHTML = `<p class="error-message">Gagal memuat ${title}: ${error.message}</p>`;
        }
    }

    async function renderInputAbsensi() {
        const panel = document.getElementById('adminPanel') || document.getElementById('guruPanel');
        panel.innerHTML = `
            <h3>Input Absensi</h3>
            <p id="absensiMessage"></p>
            <label for="absensi_siswaId">ID Siswa:</label>
            <input type="text" id="absensi_siswaId" placeholder="ID_Siswa, misal: SIS_2025001">
            <label for="absensi_tanggal">Tanggal:</label>
            <input type="date" id="absensi_tanggal" value="${new Date().toISOString().slice(0, 10)}">
            <label for="absensi_status">Status Kehadiran:</label>
            <select id="absensi_status">
                <option value="Hadir">Hadir</option>
                <option value="Sakit">Sakit</option>
                <option value="Izin">Izin</option>
                <option value="Alpha">Alpha</option>
            </select>
            <label for="absensi_keterangan">Keterangan (Opsional):</label>
            <input type="text" id="absensi_keterangan" placeholder="Alasan jika sakit/izin">
            <button id="submitAbsensiBtn">Submit Absensi</button>
        `;

        document.getElementById('submitAbsensiBtn').addEventListener('click', async () => {
            const absensiRecord = {
                ID_Siswa: document.getElementById('absensi_siswaId').value,
                Tanggal: document.getElementById('absensi_tanggal').value,
                Status_Kehadiran: document.getElementById('absensi_status').value,
                Keterangan: document.getElementById('absensi_keterangan').value
            };
            const messageElem = document.getElementById('absensiMessage');

            messageElem.className = '';
            messageElem.textContent = '';

            if (!absensiRecord.ID_Siswa || !absensiRecord.Tanggal || !absensiRecord.Status_Kehadiran) {
                messageElem.className = 'error-message';
                messageElem.textContent = 'Harap lengkapi semua bidang yang wajib (ID Siswa, Tanggal, Status).';
                return;
            }

            messageElem.textContent = 'Menyimpan absensi...';
            try {
                 // Kirim absensiRecords sebagai array tunggal jika hanya menginput 1 record
                 const result = await callAppsScript('inputAbsensi', 'Absensi', { absensiRecords: [absensiRecord] });
                 messageElem.className = 'success-message';
                 messageElem.textContent = result.message;
                 // Clear form after success
                 document.getElementById('absensi_siswaId').value = '';
                 document.getElementById('absensi_keterangan').value = '';
            } catch (error) {
                messageElem.className = 'error-message';
                messageElem.textContent = 'Error: ' + error.message;
            }
        });
    }

    async function renderInputNilai() {
        const panel = document.getElementById('adminPanel') || document.getElementById('guruPanel');
        panel.innerHTML = `
            <h3>Input Nilai</h3>
            <p id="nilaiMessage"></p>
            <label for="nilai_siswaId">ID Siswa:</label>
            <input type="text" id="nilai_siswaId" placeholder="ID_Siswa, misal: SIS_2025001">
            <label for="nilai_mapel">Mata Pelajaran:</label>
            <input type="text" id="nilai_mapel" placeholder="Nama Mata Pelajaran">
            <label for="nilai_kategori">Kategori Nilai:</label>
            <input type="text" id="nilai_kategori" placeholder="UTS, UAS, Tugas1, dll.">
            <label for="nilai_score">Nilai:</label>
            <input type="number" id="nilai_score" min="0" max="100" placeholder="0-100">
            <label for="nilai_tanggalInput">Tanggal Input:</label>
            <input type="date" id="nilai_tanggalInput" value="${new Date().toISOString().slice(0, 10)}">
            <button id="submitNilaiBtn">Submit Nilai</button>
        `;

        document.getElementById('submitNilaiBtn').addEventListener('click', async () => {
            const nilaiRecord = {
                ID_Siswa: document.getElementById('nilai_siswaId').value,
                Mata_Pelajaran: document.getElementById('nilai_mapel').value,
                Kategori_Nilai: document.getElementById('nilai_kategori').value,
                Nilai: parseFloat(document.getElementById('nilai_score').value),
                Tanggal_Input: document.getElementById('nilai_tanggalInput').value
            };
            const messageElem = document.getElementById('nilaiMessage');

            messageElem.className = '';
            messageElem.textContent = '';

            if (!nilaiRecord.ID_Siswa || !nilaiRecord.Mata_Pelajaran || !nilaiRecord.Kategori_Nilai || isNaN(nilaiRecord.Nilai) || !nilaiRecord.Tanggal_Input) {
                messageElem.className = 'error-message';
                messageElem.textContent = 'Harap lengkapi semua bidang yang wajib.';
                return;
            }

            messageElem.textContent = 'Menyimpan nilai...';
            try {
                const result = await callAppsScript('inputNilai', 'Nilai', { nilaiRecord });
                messageElem.className = 'success-message';
                messageElem.textContent = result.message;
                // Clear form after success
                document.getElementById('nilai_siswaId').value = '';
                document.getElementById('nilai_mapel').value = '';
                document.getElementById('nilai_kategori').value = '';
                document.getElementById('nilai_score').value = '';
            } catch (error) {
                messageElem.className = 'error-message';
                messageElem.textContent = 'Error: ' + error.message;
            }
        });
    }

    async function renderRekapAbsensi() {
        const panel = document.getElementById('adminPanel') || document.getElementById('guruPanel');
        panel.innerHTML = `
            <h3>Rekap Absensi</h3>
            <p id="rekapAbsensiMessage"></p>
            <label for="rekap_absensi_siswaId">Filter ID Siswa (Opsional):</label>
            <input type="text" id="rekap_absensi_siswaId" placeholder="Misal: SIS_2025001">
            <label for="rekap_absensi_month">Filter Bulan (YYYY-MM, Opsional):</label>
            <input type="month" id="rekap_absensi_month" value="${new Date().toISOString().slice(0, 7)}">
            <button id="filterRekapAbsensiBtn">Tampilkan Rekap</button>
            <div id="rekapAbsensiDisplay"></div>
        `;

        document.getElementById('filterRekapAbsensiBtn').addEventListener('click', async () => {
            const siswaIdFilter = document.getElementById('rekap_absensi_siswaId').value;
            const monthFilter = document.getElementById('rekap_absensi_month').value;
            const filter = {};
            if (siswaIdFilter) filter.ID_Siswa = siswaIdFilter;
            if (monthFilter) filter.month = monthFilter;

            const displayArea = document.getElementById('rekapAbsensiDisplay');
            const messageElem = document.getElementById('rekapAbsensiMessage');
            messageElem.className = '';
            messageElem.textContent = 'Memuat rekap absensi...';

            try {
                const rekapData = await callAppsScript('getRekapAbsensi', null, { filter });
                if (rekapData && rekapData.length > 0) {
                    let tableHtml = `
                        <table>
                            <thead>
                                <tr>
                                    <th>ID Siswa</th>
                                    <th>Nama Lengkap</th>
                                    <th>Kelas</th>
                                    <th>Hadir</th>
                                    <th>Sakit</th>
                                    <th>Izin</th>
                                    <th>Alpha</th>
                                    <th>Total Kehadiran</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;
                    rekapData.forEach(row => {
                        tableHtml += `
                            <tr>
                                <td>${row.ID_Siswa}</td>
                                <td>${row.Nama_Lengkap}</td>
                                <td>${row.Kelas}</td>
                                <td>${row.Hadir}</td>
                                <td>${row.Sakit}</td>
                                <td>${row.Izin}</td>
                                <td>${row.Alpha}</td>
                                <td>${row.Total}</td>
                            </tr>
                        `;
                    });
                    tableHtml += `</tbody></table>`;
                    displayArea.innerHTML = tableHtml;
                    messageElem.textContent = 'Rekap absensi berhasil dimuat.';
                    messageElem.className = 'success-message';
                } else {
                    displayArea.innerHTML = '<p>Tidak ada data absensi untuk filter ini.</p>';
                    messageElem.textContent = ''; // Clear loading message
                }
            } catch (error) {
                displayArea.innerHTML = '';
                messageElem.className = 'error-message';
                messageElem.textContent = 'Error memuat rekap absensi: ' + error.message;
            }
        });
    }

    async function renderRekapNilai() {
        const panel = document.getElementById('adminPanel') || document.getElementById('guruPanel');
        panel.innerHTML = `
            <h3>Rekap Nilai</h3>
            <p id="rekapNilaiMessage"></p>
            <label for="rekap_nilai_siswaId">Filter ID Siswa (Opsional):</label>
            <input type="text" id="rekap_nilai_siswaId" placeholder="Misal: SIS_2025001">
            <label for="rekap_nilai_mapel">Filter Mata Pelajaran (Opsional):</label>
            <input type="text" id="rekap_nilai_mapel" placeholder="Misal: Informatika">
            <button id="filterRekapNilaiBtn">Tampilkan Rekap</button>
            <div id="rekapNilaiDisplay"></div>
        `;

        document.getElementById('filterRekapNilaiBtn').addEventListener('click', async () => {
            const siswaIdFilter = document.getElementById('rekap_nilai_siswaId').value;
            const mapelFilter = document.getElementById('rekap_nilai_mapel').value;
            const filter = {};
            if (siswaIdFilter) filter.ID_Siswa = siswaIdFilter;
            if (mapelFilter) filter.Mata_Pelajaran = mapelFilter;

            const displayArea = document.getElementById('rekapNilaiDisplay');
            const messageElem = document.getElementById('rekapNilaiMessage');
            messageElem.className = '';
            messageElem.textContent = 'Memuat rekap nilai...';

            try {
                const rekapData = await callAppsScript('getRekapNilai', null, { filter });
                if (rekapData && rekapData.length > 0) {
                    let tableHtml = `
                        <table>
                            <thead>
                                <tr>
                                    <th>ID Siswa</th>
                                    <th>Nama Lengkap</th>
                                    <th>Kelas</th>
                                    <th>Mata Pelajaran</th>
                                    <th>Rata-rata Nilai</th>
                                    <th>Status KKM</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;
                    rekapData.forEach(row => {
                        tableHtml += `
                            <tr>
                                <td>${row.ID_Siswa}</td>
                                <td>${row.Nama_Lengkap}</td>
                                <td>${row.Kelas}</td>
                                <td>${row.Mata_Pelajaran}</td>
                                <td>${row.Rata_Rata_Nilai}</td>
                                <td style="color: ${row.Status_KKM === 'Lulus' ? 'green' : 'red'};">${row.Status_KKM}</td>
                            </tr>
                        `;
                    });
                    tableHtml += `</tbody></table>`;
                    displayArea.innerHTML = tableHtml;
                    messageElem.textContent = 'Rekap nilai berhasil dimuat.';
                    messageElem.className = 'success-message';
                } else {
                    displayArea.innerHTML = '<p>Tidak ada data nilai untuk filter ini.</p>';
                    messageElem.textContent = ''; // Clear loading message
                }
            } catch (error) {
                displayArea.innerHTML = '';
                messageElem.className = 'error-message';
                messageElem.textContent = 'Error memuat rekap nilai: ' + error.message;
            }
        });
    }

    async function renderCreateUser() {
        const panel = document.getElementById('adminPanel');
        panel.innerHTML = `
            <h3>Buat User Baru</h3>
            <p id="createUserMessage"></p>
            <label for="newUsername">Username:</label>
            <input type="text" id="newUsername" placeholder="Username unik">
            <label for="newPassword">Password:</label>
            <input type="password" id="newPassword" placeholder="Password">
            <label for="newUserRole">Peran:</label>
            <select id="newUserRole">
                <option value="Admin">Admin</option>
                <option value="Guru">Guru</option>
                <option value="Siswa">Siswa</option>
            </select>
            <button id="submitUserBtn">Buat User</button>
        `;

        document.getElementById('submitUserBtn').addEventListener('click', async () => {
            const userData = {
                Username: document.getElementById('newUsername').value,
                password: document.getElementById('newPassword').value, // akan di-hash di backend
                Role: document.getElementById('newUserRole').value
            };
            const messageElem = document.getElementById('createUserMessage');

            messageElem.className = '';
            messageElem.textContent = '';

            if (!userData.Username || !userData.password || !userData.Role) {
                messageElem.className = 'error-message';
                messageElem.textContent = 'Harap lengkapi semua bidang.';
                return;
            }

            messageElem.textContent = 'Membuat user...';
            try {
                const result = await callAppsScript('createUser', 'Users', userData);
                messageElem.className = 'success-message';
                messageElem.textContent = result.message;
                // Clear form
                document.getElementById('newUsername').value = '';
                document.getElementById('newPassword').value = '';
            } catch (error) {
                messageElem.className = 'error-message';
                messageElem.textContent = 'Error: ' + error.message;
            }
        });
    }

    // --- Inisialisasi Aplikasi ---
    renderLoginPage(); // Tampilkan halaman login saat aplikasi dimuat pertama kali
});
