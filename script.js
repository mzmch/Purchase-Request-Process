const SHEET_URL = "https://script.google.com/macros/s/AKfycbwrD1VSI1S29u7NydQoEBW9PBxjRfhl0JoPFILANzgaumAK0PHi4-YyHGUI14WMqrnO/exec";
let allData = [];
let currentPage = 1;
let currentStatus = 'waiting';
const pageSize = 10;
let currentAction = '';
let currentRow = 0;
let menuOpen = false;
let headers = [];
let selectedRowData = null;
let currentRequestNumber = null; // To store the request number when the modal is opened

function toggleMenu() {
    const submenu = document.getElementById("submenu");
    const arrow = document.getElementById("arrow");
    menuOpen = !menuOpen;
    submenu.classList.toggle("show", menuOpen);
    arrow.innerHTML = menuOpen ? "&#9660;" : "&#9654;";
}

function formatDate(inputDate) {
    const date = new Date(inputDate);
    if (isNaN(date)) return inputDate;
    const options = { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
    return date.toLocaleString('en-US', options);
}

function fetchData() {
    const dept = document.getElementById("searchDept").value.trim();
    const mobile = document.getElementById("searchMobile").value.trim();
    document.getElementById("loading").style.display = "flex";
    document.getElementById("error-message").textContent = "";

    const url = `${SHEET_URL}?department=${encodeURIComponent(dept)}&mobile=${encodeURIComponent(mobile)}`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Fetched Data:", data);
            if (data && data.error) {
                document.getElementById("error-message").textContent = "Error from server: " + data.error;
                document.getElementById("loading").style.display = "none";
                return;
            }
            allData = data.slice(1);
            headers = data[0];
            if (currentStatus !== 'all') {
                allData = allData.filter(row => row[14]?.toLowerCase() === currentStatus);
            }
            currentPage = 1;
            renderTable();
            document.getElementById("loading").style.display = "none";
        })
        .catch(error => {
            console.error("Fetch error:", error);
            document.getElementById("error-message").textContent = "Error: " + error.message;
            document.getElementById("loading").style.display = "none";
        });
}

function filterByStatus(status, el) {
    currentStatus = status;
    document.querySelectorAll('.submenu li').forEach(li => li.classList.remove('active'));
    el.classList.add('active');
    fetchData();
}

function renderTable() {
    const tbody = document.querySelector("#data-table tbody");
    tbody.innerHTML = "";
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageData = allData.slice(start, end);

    const tableHeaders = currentStatus === 'waiting'
        ? ["Request No", "Date", "Name", "Department", "Mobile", "Email", "Item", "Specification", "Estimated Cost", "Total Cost", "Justification", "Vendor", "Contact", "Reason", "Action"]
        : ["Date", "Name", "Department", "Mobile", "Email", "Item", "Specification", "Estimated Cost", "Total Cost", "Justification", "Vendor", "Contact", "Reason", "Action"];

    const thead = document.querySelector("#data-table thead tr");
    thead.innerHTML = "";
    tableHeaders.forEach(headerText => {
        const th = document.createElement("th");
        th.textContent = headerText;
        thead.appendChild(th);
    });

    pageData.forEach((row, index) => {
        const tr = document.createElement("tr");
        tr.dataset.row = JSON.stringify(row);
        tr.addEventListener('click', () => showRowDetails(row));

        let cellValues;
        if (currentStatus === 'waiting') {
            cellValues = [row[13], ...row.slice(0, 13)]; // request number is in index 13
        } else {
            cellValues = row.slice(0, 13);
        }

        cellValues.forEach((cell, idx) => {
            const td = document.createElement("td");
            let cellContent = String(cell);
            if (cellContent.length > 100) {
                cellContent = cellContent.substring(0, 100) + "...";
            }
            td.textContent = idx === 1 && currentStatus !== 'waiting' ? formatDate(cell) : cellContent;
            td.textContent = idx === 1 && currentStatus === 'waiting' ? formatDate(cell) : cellContent;
            tr.appendChild(td);
        });

        const td = document.createElement("td");
        if (currentStatus === 'waiting') {
            td.innerHTML = `
                <button onclick="openModal('approve', '${row[13]}')">Approve</button>
                <button onclick="openModal('reject', '${row[13]}')">Reject</button>
            `;
        } else if (currentStatus === 'all') {
            let actionContent = row[14] || '';
            if (actionContent.length > 100) {
                actionContent = actionContent.substring(0, 100) + "...";
            }
            td.textContent = actionContent;
        } else {
            td.textContent = '';
        }
        tr.appendChild(td);
        tbody.appendChild(tr);
    });
    renderPagination();
}

function renderPagination() {
    const pagination = document.getElementById("pagination");
    pagination.innerHTML = "";
    const totalPages = Math.ceil(allData.length / pageSize);
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        btn.onclick = () => { currentPage = i; renderTable(); };
        if (i === currentPage) btn.disabled = true;
        pagination.appendChild(btn);
    }
}

function exportToExcel() {
    const table = document.getElementById("data-table");
    if (!table) {
        alert('Table element not found.');
        return;
    }
    let tableHTML = table.outerHTML.replace(/ /g, '%20');
    const filename = 'purchase_requests.xls';
    const dataType = 'application/vnd.ms-excel';

    const a = document.createElement('a');
    document.body.appendChild(a);
    a.href = 'data:' + dataType + ', ' + tableHTML;
    a.download = filename;
    a.click();
    document.body.removeChild(a);
}

function openModal(action, requestNumber) {
    currentAction = action;
    currentRequestNumber = requestNumber; // Store the request number
    document.getElementById("modal").style.display = "flex";
}

function closeModal() {
    document.getElementById("modal").style.display = "none";
    document.getElementById("note").value = "";
}

document.getElementById("submitNote").addEventListener("click", function submitNote() {
    const note = document.getElementById("note").value.trim();
    if (!note) return alert("Please enter a note.");

    const userData = localStorage.getItem("user");
    const email = userData ? JSON.parse(userData).email : "Unknown";
    const now = new Date().toLocaleString('en-US', { hour12: true });

    if (!currentRequestNumber) return alert("Request number is missing.");

    fetch(SHEET_URL, {
        method: "POST",
        body: JSON.stringify({
            action: currentAction,
            requestNumber: currentRequestNumber, // Use the stored request number
            email: email,
            timestamp: now,
            note: note
        })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            alert(data.result === "success" ? "Submitted!" : "Error occurred.");
            closeModal();
            fetchData();
        })
        .catch(err => alert("Error: " + err.message));
});

function showRowDetails(rowData) {
    selectedRowData = rowData;
    const detailsTableBody = document.querySelector("#details-table tbody");
    detailsTableBody.innerHTML = "";

    let i = 0;
    for (const [key, value] of Object.entries(rowData)) {
        const tr = document.createElement("tr");
        const keyTd = document.createElement("td");
        const valueTd = document.createElement("td");
        const displayValue = String(value);

        keyTd.textContent = headers[i];
        valueTd.textContent = displayValue;

        tr.appendChild(keyTd);
        tr.appendChild(valueTd);
        detailsTableBody.appendChild(tr);
        i++;
    }

    const detailsActions = document.getElementById("detailsActions");
    detailsActions.innerHTML = '';

    if (rowData[14]?.toLowerCase() === 'waiting') {
        const approveButton = document.createElement("button");
        approveButton.textContent = "Approve";
        approveButton.id = "detailsApprove";
        approveButton.onclick = handleDetailsApprove;
        detailsActions.appendChild(approveButton);

        const rejectButton = document.createElement("button");
        rejectButton.textContent = "Reject";
        approveButton.id = "detailsReject";
        rejectButton.onclick = handleDetailsReject;
        detailsActions.appendChild(rejectButton);
    }

    const printButton = document.createElement("button");
    printButton.textContent = "Print";
    printButton.onclick = printDetails;
    detailsActions.appendChild(printButton);

    const closeButton = document.createElement("button");
    closeButton.textContent = "Close";
    closeButton.onclick = closeDetailsModal;
    detailsActions.appendChild(closeButton);

    document.getElementById("detailsModal").style.display = "flex";
}

function closeDetailsModal() {
    document.getElementById("detailsModal").style.display = "none";
}

function handleApprove() {
    if (!selectedRowData) return;
    const requestNumber = selectedRowData[13];
    openModal('approve', requestNumber);
}

function handleReject() {
    if (!selectedRowData) return;
    const requestNumber = selectedRowData[13];
    openModal('reject', requestNumber);
}

function handleDetailsApprove() {
    if (!selectedRowData) return;
    const requestNumber = selectedRowData[13];
    openModal('approve', requestNumber);
}

function handleDetailsReject() {
    if (!selectedRowData) return;
    const requestNumber = selectedRowData[13];
    openModal('reject', requestNumber);
}

function logout() {
    localStorage.removeItem("user");
    window.location.href = "index.html";
}

function printDetails() {
    const rowData = selectedRowData;
    if (!rowData || !headers.length) return;

    let html = `
        <html>
        <head>
            <title>Print Details</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                }
                h2 {
                    color: #2e7d32;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                th, td {
                    padding: 10px;
                    border: 1px solid #ccc;
                    text-align: left;
                }
                th {
                    background-color: #2e7d32;
                    color: white;
                }
            </style>
        </head>
        <body>
            <h2>Purchase Request Details</h2>
            <table>
                <thead>
                    <tr><th>Field</th><th>Value</th></tr>
                </thead>
                <tbody>`;
    rowData.forEach((value, index) => {
        html += `
                    <tr>
                        <td>${headers[index] || "Field " + (index + 1)}</td>
                        <td>${value}</td>
                    </tr>`;
    });

    html += `
                </tbody>
            </table>
        </body>
        </html>`;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
}

function displayUserEmail() {
    const userData = localStorage.getItem("user");
    if (userData) {
        const parsedUser = JSON.parse(userData);
        const email = parsedUser.email;
        document.getElementById("email-display").textContent = "Logged in: " + email;
    } else {
        document.getElementById("email-display").textContent = "Not logged in.";
    }
}

window.addEventListener("DOMContentLoaded", function() {
    fetchData();
    displayUserEmail();
});

let sessionTimeout, warningTimeout, countdownInterval;
const sessionLimit = 30 * 60 * 1000;
const warningTime = 28 * 60 * 1000;

function resetSessionTimers() {
    clearTimeout(sessionTimeout);
    clearTimeout(warningTimeout);
    clearInterval(countdownInterval);
    const existingWarning = document.getElementById("session-warning");
    if (existingWarning) {
        existingWarning.remove();
    }

    warningTimeout = setTimeout(showCountdownWarning, warningTime);

    sessionTimeout = setTimeout(() => {
        alert("Session expired due to inactivity.");
        localStorage.removeItem("user");
        window.location.href = "index.html";
    }, sessionLimit);
}

function showCountdownWarning() {
    const div = document.createElement("div");
    div.id = "session-warning";
    div.style.position = "fixed";
    div.style.top = "0";
    div.style.left = "0";
    div.style.width = "100%";
    div.style.height = "100%";
    div.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    div.style.display = "flex";
    div.style.flexDirection = "column";
    div.style.alignItems = "center";
    div.style.justifyContent = "center";
    div.style.zIndex = "9999";
    div.style.color = "white";
    div.style.textAlign = "center";
    div.innerHTML = `
        <img src="https://drive.google.com/uc?export=view&id=1otD1-q33yGpG8Y4oD87HT-E3DmmLApUO"
            alt="Logo" style="width:150px; height:auto; margin-bottom: 20px; animation: pulse 2s infinite;">
        <div style="font-size: 24px;">
            ⏳ <span id="countdown-timer">120</span> seconds left! Stay active 😃🎉🥳
        </div>`;
    document.body.appendChild(div);

    let secondsLeft = 120;
    countdownInterval = setInterval(() => {
        secondsLeft--;
        if (secondsLeft <= 0) {
            clearInterval(countdownInterval);
            div.innerHTML = '<h2 style="color:white;">🚪 Session expired!</h2>';
        } else {
            const timerElement = document.getElementById("countdown-timer");
            if (timerElement) {
                timerElement.textContent = secondsLeft;
            }
        }
    }, 1000);
}

const style = document.createElement("style");
style.innerHTML = `
    @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
        100% { transform: scale(1); opacity: 1; }
    }
`;
document.head.appendChild(style);

["click", "mousemove", "keypress", "scroll", "touchstart"].forEach(evt =>
    document.addEventListener(evt, resetSessionTimers)
);

window.addEventListener("load", resetSessionTimers);
