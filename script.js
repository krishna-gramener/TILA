import { html, render } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";

const pdfViewerCard = document.getElementById("undertakingPdfViewerCard");
const pdfViewer = document.getElementById("undertakingPdfViewer");

const state = {
  undertakingPdfs: {},
  loanPdfs: {},
  undertakingExcel: {},
};

const filesUploaded = {
  isUndertakingPdf: false,
  isUndertakingExcel: false,
  isCustomerLoanPdf: false,
};

const { token } = await fetch("https://llmfoundry.straive.com/token", { credentials: "include" }).then((r) => r.json());
if (!token) {
  document.getElementById("main-container").classList.add("d-none");
  const url = "https://llmfoundry.straive.com/login?" + new URLSearchParams({ next: location.href });
  render(html`<a class="btn btn-primary" href="${url}">Log into LLM Foundry</a></p>`, document.querySelector("#login"));
}
// ----------------------------------------------Misc Functions----------------------------------------------
function extractJSON(data) {
  const jsonPattern = /```json([\s\S]*?)```/;
  const match = data.match(jsonPattern);
  let jsonData = {};
  if (match) {
    // Step 2: Parse the JSON string to a JavaScript object
    try {
      jsonData = JSON.parse(match[1].trim());

      return jsonData; // Logs the parsed JSON object
    } catch (error) {
      showError("Invalid JSON:", error);
    }
  } else {
    showError("No JSON block found in the markdown.");
  }
}

// Show/hide loading spinner
function toggleLoading(show) {
  document.getElementById("loadingSpinner").style.display = show ? "block" : "none";
}

// Show error message
function showError(message) {
  alert(`Error: ${message}`);
}

// Highlight numbers in text
function highlightNumbers(text) {
  return text.replace(/\b\d+(\.\d+)?\b/g, '<span class="number">$&</span>');
}

// ----------------------------------------------Generate Tables----------------------------------------------
function generateSingleTable(data) {
  const allowedKeys = [
    "Creditor",
    "Borrower",
    "Annual Percentage Rate (APR)",
    "Finance Charge",
    "Amount Financed",
    "Total of Payments",
    "Monthly Payment Amount",
    "Number of Payments",
    "Returned Payment Fee",
    "Origination Fee",
    "Late Charges",
  ];

  let table = `
    <table class="table table-stripped">
      <thead>
        <tr>
          <th>Feature</th>
          <th>Tila</th>
        </tr>
      </thead>
      <tbody>`;

  for (const [key, value] of Object.entries(data)) {
    // Only include the allowed keys
    if (!allowedKeys.includes(key)) continue;

    table += `
      <tr>
        <td>${key}</td>
        <td>${value}</td>
      </tr>`;
  }

  table += `
      </tbody>
    </table>`;

  return table;
}

function generateExcelTable() {
  const selectedPdf = document.getElementById("undertakingPdfSelect").value;
  const pdfData = state.undertakingPdfs[selectedPdf]; // JSON object for PDF data
  const excelData = state.undertakingExcel; // JSON array containing Excel data for all sheets

  if (!pdfData || !excelData) {
    showError("PDF or Excel data is missing.");
    return;
  }

  // Define the fields to compare and their mappings
  const fieldMappings = {
    Borrower: "Borrower",
    "Annual Percentage Rate (APR)": "APR",
    "Finance Charge": "Finance Charge",
    "Amount Financed": "Amount Financed",
    "Total of Payments": "Total of Payments",
    "Monthly Payment Amount": "EMI Amount",
    "Number of Payments": "Number of Payments",
    "Returned Payment Fee": "Returned Payment Charges",
    "Origination Fee": "Origination Fee",
    "Late Charges": "Late Fee Charges",
  };

  // Attempt to find the corresponding Excel row by Loan ID
  const loanId = pdfData["Account Number"];
  const matchingRow = excelData.find((ele) => ele["Loan Id"] == loanId);

  if (!matchingRow) {
    showError("No matching row found in Excel data for the provided Loan ID.");
    return `<p>No matching data found for Loan ID: ${loanId}</p>`;
  }

  // Start creating the HTML table
  let table = `
    <table class="table table-striped">
      <thead>
        <tr>
          <th>Field</th>
          <th>TILA Data</th>
          <th>Excel Data</th>
          <th>Match</th>
        </tr>
      </thead>
      <tbody>`;

  // Iterate over the field mappings and compare the values
  for (const [pdfField, excelField] of Object.entries(fieldMappings)) {
    // Handle specific fields with custom logic
    if (pdfField === "Returned Payment Fee" || pdfField === "Late Charges") {
      table += `
        <tr>
          <td>${pdfField}</td>
          <td>${pdfData[pdfField] || "N/A"}</td>
          <td>NA</td>
          <td>NA</td>
        </tr>`;
      continue;
    }

    // PDF value handling (remove $ or %, and parse as number)
    let pdfValueRaw = pdfData[pdfField] !== undefined ? pdfData[pdfField] : "N/A";
    let pdfValue =
      typeof pdfValueRaw === "string"
        ? parseFloat(pdfValueRaw.replace(/[$,%]/g, "")) // Remove $ and % for comparison
        : pdfValueRaw;

    // Excel value handling
    let excelValue = matchingRow && matchingRow[excelField] !== undefined ? matchingRow[excelField] : "N/A";

    // Special handling for "Annual Percentage Rate (APR)"
    if (pdfField === "Annual Percentage Rate (APR)" && typeof excelValue === "number") {
      excelValue *= 100; // Convert to percentage for comparison
      excelValue = parseFloat(excelValue.toFixed(2)); // Truncate to 2 decimal places
    }

    // Ensure Excel value is always rounded to 2 decimals for numeric fields
    if (typeof excelValue === "number") {
      excelValue = parseFloat(excelValue.toFixed(2));
    }

    // Format values for display
    const formattedPdfValue =
      pdfField === "Annual Percentage Rate (APR)"
        ? `${pdfValueRaw}`
        : [
            "Finance Charge",
            "Amount Financed",
            "Total of Payments",
            "Monthly Payment Amount",
            "Origination Fee",
          ].includes(pdfField)
        ? `${pdfValueRaw}`
        : pdfValueRaw;

    const formattedExcelValue =
      pdfField === "Annual Percentage Rate (APR)"
        ? `${excelValue}%`
        : [
            "Finance Charge",
            "Amount Financed",
            "Total of Payments",
            "Monthly Payment Amount",
            "Origination Fee",
          ].includes(pdfField)
        ? `$${excelValue}`
        : excelValue;

    // Compare the values for mismatch
    const match = pdfValue == excelValue;

    // Add a row to the table
    table += `
      <tr>
        <td>${pdfField}</td>
        <td>${formattedPdfValue}</td>
        <td>${formattedExcelValue}</td>
        <td>${match ? "Y" : "N"}</td>
      </tr>`;
  }

  // Close the table
  table += `
      </tbody>
    </table>
    <p><strong>Note</strong> : If payment is returned, returned payment charge of $20 is applicable</p>`;

  // Return the table
  return table;
}

function generateFinalUndertakingTable() {
  const pdfDataArray = state.undertakingPdfs; // Array of PDF data objects
  const excelDataArray = state.undertakingExcel; // Array of Excel data objects

  // Initialize counters and mismatch trackers
  let totalAccountsChecked = 0;
  let accountsWithIncorrectData = 0;
  let incorrectAccountsByField = {
    "Annual Percentage Rate (APR)": [],
    "Finance Charge": [],
    "Amount Financed": [],
    "Total of Payments": [],
    "Number of Payments": [],
    "Monthly Payment Amount": [],
    "Origination Fee": [],
  };

  // Field mapping between PDF and Excel
  const fieldMapping = {
    "Annual Percentage Rate (APR)": "APR",
    "Finance Charge": "Finance Charge",
    "Amount Financed": "Amount Financed",
    "Total of Payments": "Total of Payments",
    "Number of Payments": "Number of Payments",
    "Monthly Payment Amount": "EMI Amount", // Map Monthly Payment Amount to EMI Amount
    "Origination Fee": "Origination Fee",
  };

  // Iterate through the PDF data array
  Object.entries(pdfDataArray).forEach(([key, pdfData]) => {
    if (key === "all") return; // Skip summary objects if present
    const loanId = pdfData["Account Number"];
    const matchingExcelRow = excelDataArray.find((excelData) => excelData["Loan Id"] == loanId);
    const path = key;
    if (matchingExcelRow) {
      totalAccountsChecked++;

      // Check for mismatches in specific fields
      for (const [pdfField, excelField] of Object.entries(fieldMapping)) {
        // Parse PDF and Excel values consistently
        let pdfValue = parseFloat(pdfData[pdfField]?.replace(/[$,%]/g, "")) || 0;
        let excelValue = parseFloat(matchingExcelRow[excelField]) || 0;

        // Special handling for fields with percentage or dollar values
        if (pdfField === "Annual Percentage Rate (APR)") {
          excelValue *= 100; // Multiply by 100 for Excel data
        }

        // Ensure both values are truncated to 2 decimal places
        pdfValue = parseFloat(pdfValue.toFixed(2));
        excelValue = parseFloat(excelValue.toFixed(2));

        // Track mismatched accounts
        if (pdfValue !== excelValue) {
          accountsWithIncorrectData++;

          // Format `ExcelValue` for display
          const formattedExcelValue =
            pdfField === "Annual Percentage Rate (APR)"
              ? `${excelValue}%`
              : [
                  "Finance Charge",
                  "Amount Financed",
                  "Total of Payments",
                  "Monthly Payment Amount",
                  "Origination Fee",
                ].includes(pdfField)
              ? `$${excelValue}`
              : excelValue;

          incorrectAccountsByField[pdfField].push({
            ApplicationId: matchingExcelRow["Application Id"],
            LoanId: loanId,
            BookingDate: matchingExcelRow["Booking Date"] || "N/A",
            PdfValue: pdfData[pdfField] || "N/A",
            ExcelValue: formattedExcelValue || "N/A",
            Path: path || "", // Ensure formatted display
          });
        }
      }
    }
  });

  // Generate category-wise summary for incorrect accounts
  let categorySummaryRows = Object.entries(incorrectAccountsByField)
    .map(([field, accounts]) => {
      return `
        <tr>
          <th>Number of Incorrect Accounts for ${field}</th>
          <td>${accounts.length}</td>
        </tr>`;
    })
    .join("");

  // Generate tables for incorrect accounts by field
  let mismatchTables = Object.entries(incorrectAccountsByField)
    .map(([field, mismatchedAccounts]) => {
      if (mismatchedAccounts.length === 0) return ""; // Skip if no mismatches

      const rows = mismatchedAccounts
        .map(
          (account) => `
          <tr class="clickable-row" data-pdf-url="${account.Path}" style="cursor: pointer;">
            <td>${account.ApplicationId}</td>
            <td>${account.LoanId}</td>
            <td>${account.BookingDate}</td>
            <td>${account.PdfValue}</td>
            <td>${account.ExcelValue}</td>
            <td>
            <button class="email-btn" data-loan-id="${account.LoanId}" data-category="${field}">
              <i class="bi bi-envelope"></i>
            </button>
            </td>
          </tr>`
        )
        .join("");

      return `
        <h3>Incorrect Accounts for ${field}</h3>
        <table class="table table-striped">
          <thead>
            <tr>
              <th>Application ID</th>
              <th>Loan ID</th>
              <th>Booking Date</th>
              <th>${field} (TILA)</th>
              <th>${field} (Production)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>`;
    })
    .join("");

  // Generate the summary table
  let summaryTable = `
      <table class="table table-striped mb-4">
        <tbody>
          <tr>
            <th>Total Accounts Checked</th>
            <td>${totalAccountsChecked}</td>
          </tr>
          <tr>
            <th>Total Accounts with Incorrect Data</th>
            <td>${accountsWithIncorrectData}</td>
          </tr>
          ${categorySummaryRows}
        </tbody>
      </table>`;

  // Return both the summary table and the mismatch tables
  return {
    summaryTable: summaryTable,
    mismatchTables: mismatchTables,
  };
}

function generateLoanIndividualReport() {
  const pdfArray = state.undertakingPdfs;
  const excelArray = state.undertakingExcel;
  const selectedLoanId = document.querySelector("#loanPdfSelect").value;
  const loanData = state.loanPdfs[selectedLoanId];

  if (!loanData) {
    showError("No matching loan data found.");
    return `<p>No data found for Loan ID: ${selectedLoanId}</p>`;
  }

  const pdfData = Object.values(pdfArray).find((item) => item["Account Number"] === loanData["Loan Id"]) || {};
  const excelData = excelArray.find((item) => item["Loan Id"] == loanData["Loan Id"]) || {};

  const features = ["Borrower", "Account Number", "Returned Payment Fee", "Late Charges"];

  const cleanValue = (value) =>
    typeof value === "string" ? parseFloat(value.replace(/[$,%]/g, "")) || value : value !== undefined ? value : "NA";

  const formatCurrency = (feature, value) =>
    ["Returned Payment Fee", "Late Charges"].includes(feature) && value !== "NA" && !isNaN(value) ? `$${value}` : value;

  const mapExcelData = (feature) => {
    if (feature === "Returned Payment Fee") {
      return cleanValue(excelData["Returned Payment Charges"])?.toFixed(2) || "NA";
    }
    if (feature === "Account Number") return cleanValue(excelData["Loan Id"]) || "NA";
    if (feature === "Late Charges") {
      return cleanValue(excelData["Late Fee Charges"])?.toFixed(2) || "NA";
    }
    return excelData[feature] != null ? cleanValue(excelData[feature]) : "NA";
  };

  const mapLoanData = (feature) => {
    if (feature === "Borrower") return loanData[feature] || "NA";
    if (feature === "Account Number") return loanData["Loan Id"] || "NA";

    if (feature === "Returned Payment Fee") {
      const returnedPaymentFee = loanData["Payment Return Amount"];
      return returnedPaymentFee !== null ? cleanValue(returnedPaymentFee) : "NA";
    }

    if (feature === "Late Charges") {
      const returnedPaymentFee = loanData["Payment Return Amount"];
      const lateCharges = returnedPaymentFee === null ? loanData["Late Fee amount"] : "NA";
      return cleanValue(lateCharges) || "NA";
    }

    return cleanValue(loanData[feature]) || "NA";
  };

  const tableRows = features
    .map((feature) => {
      let pdfValue = cleanValue(pdfData[feature]);
      if (feature === "Late Charges") pdfValue = 7; // Set Late Charges to 7 for TILA Data

      const excelValue = mapExcelData(feature);
      const loanValue = mapLoanData(feature);

      // Determine if values match, or if any value is NA, match becomes NA
      const isMatch =
        loanValue === "NA" || pdfValue === "NA" || excelValue === "NA"
          ? "NA"
          : loanValue == pdfValue && pdfValue == excelValue
          ? "Y"
          : "N";

      // Format the values after matching
      const formattedLoanValue = formatCurrency(feature, loanValue);
      const formattedPdfValue = formatCurrency(feature, pdfValue);
      const formattedExcelValue = formatCurrency(feature, excelValue);

      return `
        <tr>
          <td>${feature}</td>
          <td>${formattedLoanValue}</td>
          <td>${formattedPdfValue !== undefined ? formattedPdfValue : "NA"}</td>
          <td>${formattedExcelValue}</td>
          <td>${isMatch}</td>
        </tr>`;
    })
    .join("");

  return `
    <table class="table table-striped">
      <thead>
        <tr>
          <th>Features</th>
          <th>Customer Comm. Data</th>
          <th>Tila Data</th>
          <th>Production Data</th>
          <th>Match</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    <p><strong>Note :</strong></p>
    <p>1) If payment is returned, returned payment charge of $20 is applicable</p>
    <p>2) 5% of the unpaid installment; up to max of $7</p>`;
}

function generateFinalCmTable() {
  const pdfArray = state.undertakingPdfs;
  const excelArray = state.undertakingExcel;
  const loanArray = state.loanPdfs;

  if (!loanArray || !Object.keys(loanArray).length) {
    return `<p>No loan data available.</p>`;
  }

  let totalAccounts = 0;
  let incorrectAccounts = 0;
  const incorrectCountsByCategory = {}; // To track incorrect counts per category

  const discrepancyData = {};

  const cleanValue = (value) =>
    typeof value === "string"
      ? parseFloat(value.replace(/[$,%]/g, "")).toFixed(2) || value
      : value !== null
      ? value.toFixed(2)
      : value !== undefined
      ? value
      : "NA";

  const formatCurrency = (value) => {
    if (value === "NA" || value === null) return "NA";
    if (!isNaN(value)) return `$${parseFloat(value).toFixed(2)}`; // Truncate to 2 decimal places
    return value;
  };

  Object.entries(loanArray).forEach(([key, loanData]) => {
    totalAccounts++;
    const loanId = loanData["Loan Id"];
    const pdfData = Object.values(pdfArray).find((item) => item["Account Number"] === loanId) || {};
    const excelData = excelArray.find((item) => item["Loan Id"] == loanId) || {};
    const bookingDate = excelData["Booking Date"] || "NA";
    const paymentMonthDate = excelData["Month Date"] || "NA";
    const path = key;
    let hasIncorrectDetails = false;
    const addDiscrepancy = (category, pdfValue, loanValue, excelValue) => {
      // Skip this discrepancy if loan value is null or pdf value is 5
      if (loanValue === null || (loanValue == 25 && excelValue == 0)) {
        return;
      }

      if (!discrepancyData[category]) {
        discrepancyData[category] = [];
        incorrectCountsByCategory[category] = 0; // Initialize count for this category
      }

      // Adjust loan value for "Late Charges"
      const adjustedPdfValue = category === "Late Charges" ? 7 : pdfValue;
      discrepancyData[category].push({
        loanId,
        bookingDate,
        paymentMonthDate,
        pdf: formatCurrency(adjustedPdfValue),
        loan: formatCurrency(loanValue),
        excel: formatCurrency(excelValue),
        Path: path,
      });

      incorrectCountsByCategory[category]++; // Increment count for this category
      hasIncorrectDetails = true;
    };

    // Returned Payment Fee Comparison
    const pdfReturnedFee = cleanValue(pdfData["Returned Payment Fee"]);
    const loanReturnedFee = cleanValue(loanData["Payment Return Amount"]); // Loan data mapping
    const excelReturnedFee = cleanValue(excelData["Returned Payment Charges"]); // Excel data mapping
    if (
      loanReturnedFee !== pdfReturnedFee ||
      loanReturnedFee !== excelReturnedFee ||
      pdfReturnedFee !== excelReturnedFee
    ) {
      addDiscrepancy("Returned Payment Fee", pdfReturnedFee, loanReturnedFee, excelReturnedFee);
    }

    // Late Charges Comparison
    const pdfLateCharges = cleanValue(pdfData["Late Charges"]);
    const loanLateCharges = cleanValue(loanData["Late Fee amount"]); // Loan data mapping
    const excelLateCharges = cleanValue(excelData["Late Fee Charges"]); // Excel data mapping
    if (
      loanLateCharges !== pdfLateCharges ||
      loanLateCharges !== excelLateCharges ||
      pdfLateCharges !== excelLateCharges
    ) {
      addDiscrepancy("Late Charges", pdfLateCharges, loanLateCharges, excelLateCharges);
    }

    if (hasIncorrectDetails) {
      incorrectAccounts++;
    }
  });

  // Generate Summary Table
  const categorySummaryRows = Object.keys(incorrectCountsByCategory)
    .map(
      (category) => `
        <tr>
          <td>${category}</td>
          <td>${incorrectCountsByCategory[category]}</td>
        </tr>`
    )
    .join("");

  const summaryTable = `
    <table class="table table-striped">
    <h3>Summary</h3>
      <thead>
        <tr>
          <th>Total Accounts Checked</th>
          <td>${totalAccounts}</td>
          </tr>
          </thead>
          <tbody>
          <tr>
          <th>Accounts with Incorrect Details</th>
          <td>${incorrectAccounts}</td>
        </tr>
      </tbody>
    </table>
    <h4>Category-Wise Incorrect Accounts</h4>
    <table class="table table-striped">
      <thead>
        <tr>
          <th>Category</th>
          <th>Incorrect Accounts</th>
        </tr>
      </thead>
      <tbody>
        ${categorySummaryRows}
      </tbody>
    </table>`;

  // Generate Category-Wise Tables
  const categoryTables = Object.keys(discrepancyData)
    .map((category) => {
      const rows = discrepancyData[category]
        .map((row) => {
          const { loanId, bookingDate, paymentMonthDate, pdf, loan, excel, Path } = row;
          return `
          <tr class="clickable-row" data-pdf-url="${Path}" style="cursor: pointer;">
              <td>${loanId}</td>
              <td>${bookingDate}</td>
              <td>${paymentMonthDate}</td>
              <td>${loan}</td>
              <td>${pdf}</td>
              <td>${excel}</td>
              <td>
              <button class="email-btn" data-loan-id="${loanId}" data-category="${category}">
              <i class="bi bi-envelope"></i>
              </td>
            </button>
            </tr>`;
        })
        .join("");

      return `
      <table class="table table-striped my-4">
      <h4>Accounts with Incorrect ${category}</h4>
          <thead>
          <tr>
              <th>Loan Id</th>
              <th>Booking Date</th>
              <th>Payment Month Date</th>
              <th>${category} (Customer Comm.)</th>
              <th>${category} (TILA)</th>
              <th>${category} (Production Data)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows || "<tr><td colspan='6'>No discrepancies found.</td></tr>"}
          </tbody>
        </table>`;
    })
    .join("");

  // Combine Tables
  return `
    <div>
      ${summaryTable}
      ${categoryTables}
    </div>`;
}

// ----------------------------------------Styling Event Listeners----------------------------------
document.getElementById("undertakingCard").addEventListener("click", () => {
  document.getElementById("undertakingSection").style.display = "block";
  document.getElementById("customerSection").style.display = "none";
  document.getElementById("undertakingCard").classList.add("bg-primary", "text-white");
  document.getElementById("customerManagementCard").classList.remove("bg-primary", "text-white");
});

document.getElementById("customerManagementCard").addEventListener("click", () => {
  document.getElementById("customerSection").style.display = "block";
  document.getElementById("undertakingSection").style.display = "none";
  document.getElementById("undertakingCard").classList.remove("bg-primary", "text-white");
  document.getElementById("customerManagementCard").classList.add("bg-primary", "text-white");
});

// ---------------------------------------Individual Reports-----------------------------------------------
document.getElementById("undertakingPdfSelect").addEventListener("change", (e) => {
  const selectedFile = e.target.value;
  const pdfContent = state.undertakingPdfs[selectedFile]?.["Complete Extracted Text"] || "";
  const individualReportCard = document.getElementById("undertakingIndividualReportCard");
  const loadingSpinner = document.getElementById("loadingSpinner");
  const pdfExtractCard = document.getElementById("undertakingPdfContentCard");

  const toggleVisibility = (isVisible) => {
    loadingSpinner.classList.toggle("d-none", !isVisible);
    pdfViewerCard.classList.toggle("d-none", isVisible);
    pdfExtractCard.classList.toggle("d-none", isVisible);
    individualReportCard.classList.toggle("d-none", isVisible);
  };

  try {
    toggleVisibility(true);

    if (!selectedFile || !pdfContent) throw new Error("PDF not found");

    // Display PDF content
    pdfViewer.src = selectedFile;
    document.getElementById("undertakingPdfContent").innerHTML = highlightNumbers(pdfContent);

    // Generate and display the table
    const table = filesUploaded.isUndertakingExcel
      ? generateExcelTable()
      : generateSingleTable(state.undertakingPdfs[selectedFile]);
    document.getElementById("undertakingIndividualReport").innerHTML = table;

    toggleVisibility(false);
  } catch (error) {
    showError(`Error handling PDF: ${error.message}`);
    toggleVisibility(false);
  }
});

document.getElementById("loanPdfSelect").addEventListener("change", (e) => {
  const selectedFile = e.target.value;
  const pdfContent = state.loanPdfs[selectedFile]?.["Complete Extracted Text"] || "";

  // Reference elements for toggling visibility
  const elements = {
    loadingSpinner: document.getElementById("loadingSpinner"),
    pdfExtractCard: document.getElementById("customerPdfContentCard"),
    pdfViewerCard: document.getElementById("customerPdfViewerCard"),
    individualReportCard: document.getElementById("customerIndividualReportCard"),
    pdfViewer: document.getElementById("customerPdfViewer"),
    pdfContentContainer: document.getElementById("customerPdfContent"),
    reportContainer: document.getElementById("customerIndividualReportCard"),
  };

  const toggleVisibility = (isLoading) => {
    elements.loadingSpinner.classList.toggle("d-none", !isLoading);
    elements.pdfViewerCard.classList.toggle("d-none", isLoading);
    elements.pdfExtractCard.classList.toggle("d-none", isLoading);
    elements.individualReportCard.classList.toggle("d-none", isLoading);
  };

  try {
    toggleVisibility(true);

    if (!selectedFile || !pdfContent) throw new Error("PDF not found");

    // Update viewer and content
    elements.pdfViewer.src = selectedFile;
    elements.pdfContentContainer.innerHTML = highlightNumbers(pdfContent);
    elements.reportContainer.innerHTML = generateLoanIndividualReport();

    toggleVisibility(false);
  } catch (error) {
    showError(`Error handling PDF: ${error.message}`);
    toggleVisibility(false);
  }
});

document.getElementById("undertakingExcelSelect").addEventListener("change", async (e) => {
  filesUploaded.isUndertakingExcel = document.getElementById("undertakingExcelSelect").value !== "";
  const selectedFile = document.getElementById("undertakingPdfSelect").value;
  const pdfContent = state.undertakingPdfs[selectedFile]["Complete Extracted Text"] || "";
  const individualReportCard = document.getElementById("undertakingIndividualReportCard");

  try {
    loadingSpinner.classList.remove("d-none");
    individualReportCard.classList.add("d-none");

    if (!selectedFile || !pdfContent) {
      throw new Error("PDF not found");
    }
    document.getElementById("undertakingIndividualReportCard").classList.remove("d-none");
    const table = generateExcelTable();
    document.getElementById("undertakingIndividualReport").innerHTML = table;
  } catch (error) {
    showError("Error handling PDF: " + error.message);
  } finally {
    loadingSpinner.classList.add("d-none");
  }
});

// ------------------------------------------Process Buttons-------------------------------------------
document.getElementById("undertakingProcess").addEventListener("click", (e) => {
  document.getElementById(
    "undertakingOutput"
  ).innerHTML = `<div class="spinner-border text-primary" role="status"></div>`;
  try {
    const { summaryTable, mismatchTables } = generateFinalUndertakingTable();
    const undertakingOutput = document.getElementById("undertakingOutput");
    undertakingOutput.innerHTML = "";
    undertakingOutput.innerHTML += "<h3>Summary of Incorrect Data</h3>" + summaryTable;
    undertakingOutput.innerHTML += mismatchTables;
  } catch (error) {
    showError("Processing failed: " + error.message);
  } finally {
    toggleLoading(false);
  }
});

document.getElementById("customerProcess").addEventListener("click", () => {
  document.getElementById("customerOutput").innerHTML = `<div class="spinner-border text-primary" role="status"></div>`;
  try {
    const table = generateFinalCmTable();
    const customerOutput = document.getElementById("customerOutput");
    customerOutput.innerHTML = "";
    customerOutput.innerHTML += table;
  } catch (error) {
    showError("Processing failed: " + error.message);
  } finally {
    toggleLoading(false);
  }
});

// ---------------------------------------File Handling--------------------------------------------------
async function loadExcelFiles(filePath, stateKey) {
  try {
    const response = await fetch(filePath);
    const data = await response.arrayBuffer(); // Fetch the binary content of the file

    const workbook = XLSX.read(data, { type: "array" });
    const excelContent = workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      return {
        sheetName: sheetName,
        data: XLSX.utils.sheet_to_json(sheet, { header: 1 }), // Ensure data extraction as an array of arrays
      };
    });

    // Store the processed data in the state object
    const customerDataExcel = await extractExcelInfoUsingGemini(excelContent);
    state[stateKey] = extractJSON(customerDataExcel);

    return excelContent; // Return the parsed data
  } catch (error) {
    showError("Error loading Excel file:", error);
    return null;
  }
}

//---------------------------------------Sending Email-------------------------------------------------------

// Function to send email without using a predefined EmailJS template
function sendEmail(loanId, category) {
  const recipientEmail = "satyajeet.jaiswal@straive.com";
  const userDetailsPdf = Object.values(state.undertakingPdfs).filter((pdfData) => {
    return loanId === pdfData["Account Number"];
  });
  const userDetailsExcel = state.undertakingExcel.find((excelData) => excelData["Loan Id"] == loanId);
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0"); // Ensure 2 digits
  const month = String(today.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  const year = today.getFullYear();
  const customDate = `${day}/${month}/${year}`;
  emailjs
    .send("service_snjh4dk", "template_9g2ly2q", {
      to_email: recipientEmail,
      subject: "Notification of Error Identified in TILA Reconciliation Process",
      message: `Dear ${userDetailsExcel["Borrower"]},\n
Re: Account Number: ${userDetailsExcel["Loan Id"]} \n
Our review has revealed discrepancies in the calculation of interest rates and/or fees associated with your loan. This error may have resulted in an incorrect balance or payment amount.
Details of the Error:\n
The error was identified on ${customDate}.\n
Error in ${category} \n
We are taking immediate action to correct the error and ensure that your account is accurately reflected.
Contact our customer service department if you have any questions or concerns.\n
Contact Information:
If you have any questions or concerns, please do not hesitate to contact us at:
Phone: 123-456-7890
Email: abc@example.com
Mailing Address: 123 Main Street, City, State, ZIP Code\n
We apologize for any inconvenience this error may have caused and appreciate your patience and understanding as we work to resolve this issue.
Sincerely,\n
Lorem Ipsum\n ${userDetailsPdf[0]["Creditor"]}\n123-456-7890 \n
`,
    })
    .then(
      (response) => {
        alert("Email sent successfully!");
      },
      (error) => {
        alert("Failed to send email. Please try again.");
        console.error("FAILED...", error);
      }
    );
}

// --------------------------------------Event Listeners-----------------------------------------------------

document.querySelector("#undertakingOutput").addEventListener("click", (e) => {
  if (e.target.closest(".email-btn")) {
    e.stopPropagation();
    const button = e.target.closest(".email-btn");
    const loanId = button.getAttribute("data-loan-id");
    const category = button.getAttribute("data-category");
    sendEmail(loanId, category);
    return;
  }

  const clickedRow = e.target.closest(".clickable-row");

  if (!clickedRow) return;

  try {
    toggleLoading(true);
    // Get the data-pdf-url from the clicked row
    const pdfUrl = clickedRow.getAttribute("data-pdf-url");

    if (!pdfUrl) {
      showError("No PDF URL found for this row.");
      return;
    }

    // Find the TILA select element
    const tilaSelect = document.querySelector("#undertakingPdfSelect");

    if (!tilaSelect) {
      showError("TILA select element not found.");
      return;
    }

    // Set the select value to match the data-pdf-url
    const matchingOption = Array.from(tilaSelect.options).find((option) => option.value === pdfUrl);

    if (matchingOption) {
      tilaSelect.value = pdfUrl; // Set the selected value
      tilaSelect.dispatchEvent(new Event("change")); // Trigger the change event

      const undertakingSection = document.querySelector("#undertakingSection");
      undertakingSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      showError("No matching option found in TILA select.");
    }
  } catch (error) {
    showError(error.message);
  } finally {
    toggleLoading(false);
  }
});



document.querySelector("#customerOutput").addEventListener("click", (e) => {

  if (e.target.closest(".email-btn")) {
    e.stopPropagation();
    const button = e.target.closest(".email-btn");
    const loanId = button.getAttribute("data-loan-id");
    const category = button.getAttribute("data-category");
    sendEmail(loanId, category);
    return;
  }

  const clickedRow = e.target.closest(".clickable-row");

  if (!clickedRow) return;

  try {
    toggleLoading(true);
    // Get the data-pdf-url from the clicked row
    const pdfUrl = clickedRow.getAttribute("data-pdf-url");

    if (!pdfUrl) {
      showError("No Customer Communication found for this row.");
      return;
    }

    // Find the TILA select element
    const customerCommSelect = document.querySelector("#loanPdfSelect");

    if (!customerSection) {
      showError("TILA select element not found.");
      return;
    }

    // Set the select value to match the data-pdf-url
    const matchingOption = Array.from(customerCommSelect.options).find((option) => option.value === pdfUrl);

    if (matchingOption) {
      customerCommSelect.value = pdfUrl; // Set the selected value
      customerCommSelect.dispatchEvent(new Event("change")); // Trigger the change event

      const customerSection = document.querySelector("#customerSection");
      customerSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      showError("No matching option found in Customer Comm. select.");
    }
  } catch (error) {
    showError(error.message);
  } finally {
    toggleLoading(false);
  }
});

async function loadFiles() {
  const undertakingPdfSelect = document.getElementById("undertakingPdfSelect");
  const undertakingExcelSelect = document.getElementById("undertakingExcelSelect");
  const loanPdfSelect = document.getElementById("loanPdfSelect");
  const extractedTexts = state.undertakingPdfs;
  const extractedLoanTexts = state.loanPdfs;
  const customerTila = document.getElementById("customerPdfSelect");
  const customerExcel = document.getElementById("customerExcelSelect");

  try {
    // Show loading indicator
    toggleLoading(true);

    // Fetch the config.json file
    const response = await fetch("config.json");
    if (!response.ok) {
      throw new Error("Failed to fetch configuration.");
    }

    // Parse the JSON data
    const { pdfs: pdfConfig, excel: excelConfig, loan: loanConfig } = await response.json(); // Separate PDFs and Excel files

    // Populate the PDF dropdown
    pdfConfig.forEach((pdf) => {
      const option = document.createElement("option");
      option.value = pdf.path; // Path will be used for loading
      option.textContent = pdf.name; // Name displayed in the dropdown
      undertakingPdfSelect.appendChild(option);

      const customerPdfOption = option.cloneNode(true);
      customerTila.append(customerPdfOption);
    });

    // Preload and cache PDF texts (optional)
    for (const pdf of pdfConfig) {
      if (!extractedTexts[pdf.path]) {
        const base64 = await getBase64FromPdf(pdf.path);
        const text = await extractTextUsingGemini(base64);
        const textInJson = extractJSON(text);
        extractedTexts[pdf.path] = textInJson;
      }
    }
    // Populate the Excel dropdown
    excelConfig.forEach((excel) => {
      const option = document.createElement("option");
      option.value = excel.path; // Path will be used for loading
      option.textContent = excel.name; // Name displayed in the dropdown
      undertakingExcelSelect.appendChild(option);

      const customerExcelOption = option.cloneNode(true);
      customerExcel.append(customerExcelOption);
    });

    // Preload and cache Excel data (optional)
    for (const excel of excelConfig) {
      const excelData = await loadExcelFiles(excel.path, "undertakingExcel"); // Function to parse Excel data
    }

    loanConfig.forEach((loan) => {
      const option = document.createElement("option");
      option.value = loan.path; // Path will be used for loading
      option.textContent = loan.name; // Name displayed in the dropdown
      loanPdfSelect.appendChild(option);
    });

    for (const loan of loanConfig) {
      if (!extractedTexts[loan.path]) {
        const base64 = await getBase64FromPdf(loan.path);
        const text = await extractLoanTextUsingGemini(base64);
        const textInJson = extractJSON(text);
        extractedLoanTexts[loan.path] = textInJson;
      }
    }

  } catch (error) {
    showError(error.message);
  } finally {
    // Hide loading indicator
    toggleLoading(false);
  }
}

async function getBase64FromPdf(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    throw new Error(`Failed to convert PDF to base64: ${error.message}`);
  }
}

async function extractTextUsingGemini(base64Pdf) {
  try {
    const response = await fetch(
      "https://llmfoundry.straive.com/gemini/v1beta/models/gemini-1.5-flash-latest:generateContent",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: `Extract and return only the text content from the provided PDF.
                Data Should be in following format :-
                {
                Complete Extracted Text,
                Creditor,
Borrower,
Account Number,
Annual Percentage Rate (APR),
Finance Charge,
Amount Financed,
Total of Payments,
Monthly Payment Amount,
Number of Payments,
Returned Payment Fee,
Origination Fee,
Late Charges,
              }
return in json format only.
                `,
              },
            ],
          },
          contents: [
            {
              role: "user",
              parts: [
                { text: "This is a PDF document for text extraction." }, // Added the `text` field to describe the PDF
                {
                  inline_data: {
                    mime_type: "application/pdf",
                    data: base64Pdf.split(",")[1], // Base64 content excluding the prefix
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Unexpected error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error) {
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

async function extractExcelInfoUsingGemini(excelData) {
  try {
    const response = await fetch(
      "https://llmfoundry.straive.com/gemini/v1beta/models/gemini-1.5-flash-latest:generateContent",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: `For Each user, extract the following information from the provided Excel Data:
                Data Should be in following format :-
                {
                Application Id,
                Loan Id,
Borrower,
APR,
Finance Charge,
Amount Financed,
Total of Payments,
EMI Amount,
Number of Payments,
Returned Payment Charges,
Origination Fee,
Booking Date,
Late Fee Charges,
Month Date
              }
return in json format only.
                `,
              },
            ],
          },
          contents: [
            {
              role: "user",
              parts: [
                { text: `This is a Excel Document for text extraction\n. ${JSON.stringify(excelData)} ` }, // Added the `text` field to describe the PDF
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Unexpected error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error) {
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

async function extractLoanTextUsingGemini(base64Pdf) {
  try {
    const response = await fetch(
      "https://llmfoundry.straive.com/gemini/v1beta/models/gemini-1.5-flash-latest:generateContent",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: `Extract and return only the text content from the provided PDF.
                Data Should be in following format :-
                {
                Complete Extracted Text,
                Borrower,
                Loan Id,
                Late Fee amount,
                Payment Return Amount
              }
return in json format only.
                `,
              },
            ],
          },
          contents: [
            {
              role: "user",
              parts: [
                { text: "This is a PDF document for text extraction." }, // Added the `text` field to describe the PDF
                {
                  inline_data: {
                    mime_type: "application/pdf",
                    data: base64Pdf.split(",")[1], // Base64 content excluding the prefix
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Unexpected error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error) {
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

// Initialize
await loadFiles().catch((error) => showError(error.message));
