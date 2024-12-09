import { html, render } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";
import * as pdfjs from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9/+esm";
pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9/build/pdf.worker.min.mjs";

const pdfViewerCard = document.getElementById("undertakingPdfViewerCard");
const pdfViewer = document.getElementById("undertakingPdfViewer");
const CACHE_KEY = "pdfExtractCache";
const CACHE_KEY_EXCEL = "excelData";
const CACHE_KEY_LOAN="loanData";

const state = {
  undertakingPdfs: {},
  loanPdfs: {},
  undertakingExcel: {}, // Initialized as an empty object
};

const filesUploaded = {
  isUndertakingPdf: false,
  isUndertakingExcel: false,
  isCustomerPdf: false,
  isCustomerLoanPdf: false,
  isCustomerExcel: false,
};

const { token } = await fetch("https://llmfoundry.straive.com/token", { credentials: "include" }).then((r) => r.json());
if (!token) {
  const url = "https://llmfoundry.straive.com/login?" + new URLSearchParams({ next: location.href });
  render(html`<a class="btn btn-primary" href="${url}">Log into LLM Foundry</a></p>`, document.querySelector("#login"));
}


try {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    state.undertakingPdfs = JSON.parse(cached);
  }
} catch (error) {
  showError("Cache loading error:", error);
}

try {
  const cached = localStorage.getItem(CACHE_KEY_EXCEL);
  if (cached) {
    state.undertakingExcel = JSON.parse(cached);
  }
} catch (error) {
  showError("Cache loading error:", error);
}

try {
  const cached = localStorage.getItem(CACHE_KEY_LOAN);
  if (cached) {
    state.loanPdfs = JSON.parse(cached);
  }
} catch (error) {
  showError("Cache loading error:", error);
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
    "Borrower": "Borrower",
    "Annual Percentage Rate (APR)": "Annual Percentage Rate (APR)",
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

    // Compare the values for mismatch (normalize strings for comparison only)
    const match =
      typeof pdfValue === "number" && typeof excelValue === "number"
        ? pdfValue.toFixed(2) == excelValue.toFixed(2) // Numeric comparison
        : typeof pdfValueRaw === "string" && typeof excelValue === "string"
        ? pdfValueRaw.trim() === excelValue.trim() // String comparison (case-sensitive, original format)
        : pdfValue == excelValue;

    // Add a row to the table
    table += `
      <tr>
        <td>${pdfField}</td>
        <td>${pdfValueRaw}</td>
        <td>${excelValue}</td>
        <td>${match ? "Y" : "N"}</td>
      </tr>`;
  }

  // Close the table
  table += `
      </tbody>
    </table>`;

  // Return the table
  return table;
}

function generateFinalUndertakingTable() {
  const pdfDataArray = state.undertakingPdfs; // Array of PDF data objects
  const excelDataArray = state.undertakingExcel; // Array of Excel data objects

  // Initialize counters for the summary table
  let totalAccountsChecked = 0;
  let accountsWithIncorrectData = 0;
  let incorrectOnFields = {
    "APR": 0,
    "Finance Charge": 0,
    "Amount Financed": 0,
    "Total of Payments": 0,
    "Number of Payments": 0,
    "Monthly Payment Amount": 0,
    "Origination Fee": 0,
  };

  // Initialize table for detailed data
  let detailedTable = `
      <table class="table table-striped">
        <thead>
          <tr>
            <th>Application ID</th>
            <th>Loan ID</th>
            <th>Booking Date</th>
            <th>Origination Fee Charges (per TILA)</th>
            <th>Origination Fee Charges (per Excel)</th>
            <th>Mismatch</th>
          </tr>
        </thead>
        <tbody>`;

  // Iterate through the PDF data array
  Object.entries(pdfDataArray).forEach(([key, pdfData]) => {
    if (key === "all") return; // Skip summary objects if present
    const loanId = pdfData["Account Number"];
    const matchingExcelRow = excelDataArray.find((excelData) => excelData["Loan Id"] == loanId);

    if (matchingExcelRow) {
      totalAccountsChecked++;

      // Initialize flag for incorrect data in any field
      let hasIncorrectData = false;

      // Check for mismatches in specific fields and increment counters
      for (const field of [
        "Annual Percentage Rate (APR)",
        "Finance Charge",
        "Amount Financed",
        "Total of Payments",
        "Number of Payments",
        "Monthly Payment Amount",
        "Origination Fee",
      ]) {
        // Map Monthly Payment Amount to EMI Amount in Excel
        const excelField =
          field === "Monthly Payment Amount" ? "EMI Amount" : field;

        // Parse PDF and Excel values consistently
        let pdfValue = parseFloat(pdfData[field]?.replace(/[$,%]/g, "")) || 0;
        let excelValue = parseFloat(matchingExcelRow[excelField]) || 0;

        // Special handling for APR field
        if (field === "Annual Percentage Rate (APR)") {
          excelValue = parseFloat((excelValue * 100).toFixed(2)); // Convert to percentage
        }

        // Round to two decimals for comparison
        pdfValue = parseFloat(pdfValue.toFixed(2));
        excelValue = parseFloat(excelValue.toFixed(2));

        // Check mismatch and update counters
        if (pdfValue !== excelValue) {
          hasIncorrectData = true;
          incorrectOnFields[field]++;
        }
      }

      // Update the number of accounts with incorrect data
      if (hasIncorrectData) {
        accountsWithIncorrectData++;
      }

      // Check if Origination Fee matches
      const originationFeePdf = parseFloat(pdfData["Origination Fee"]?.replace(/[$,]/g, "")) || 0;
      const originationFeeExcel = parseFloat(matchingExcelRow["Origination Fee"]) || 0;
      const originationFeeMismatch = originationFeePdf.toFixed(2) !== originationFeeExcel.toFixed(2) ? 'Y' : 'N';

      // Add row to the detailed table with application ID, Loan ID, Origination Fee charges, and mismatch column
      detailedTable += `
          <tr>
            <td>${matchingExcelRow["Application Id"]}</td>
            <td>${loanId}</td>
            <td>${matchingExcelRow["Booking Date"] || "N/A"}</td>
            <td>${pdfData["Origination Fee"] || "N/A"}</td>
            <td>${matchingExcelRow["Origination Fee"].toFixed(2) || "N/A"}</td>
            <td>${originationFeeMismatch}</td>
          </tr>`;
    }
  });

  // Close the detailed data table
  detailedTable += `
        </tbody>
      </table>`;

  // Create the summary table with counts
  let summaryTable = `
      <table class="table table-striped mb-4">
        <tbody>
          <tr>
            <th>Total Accounts Checked</th>
            <td>${totalAccountsChecked}</td>
          </tr>
          <tr>
            <th>Number of Accounts with Incorrect Data</th>
            <td>${accountsWithIncorrectData}</td>
          </tr>
          ${Object.entries(incorrectOnFields)
            .map(
              ([field, count]) => `
          <tr>
            <th>Number of Accounts Incorrect on ${field}</th>
            <td>${count}</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>`;

  // Return both the summary table and the detailed table
  return {
    summaryTable: summaryTable,
    detailedTable: detailedTable,
  };
}

function generateCustomerFinalTable(){

  const pdfDataArray = state.undertakingPdfs;
  const loanDataArray=state.loanPdfs;
  const selectExcel=state.undertakingExcel;



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

//Table Rendering for Individual Customer Data in undertaking Section
document.getElementById("undertakingPdfSelect").addEventListener("change", async (e) => {
  const selectedFile = e.target.value;
  const pdfContent = state.undertakingPdfs[selectedFile]["Complete Extracted Text"] || "";
  const individualReportCard = document.getElementById("undertakingIndividualReportCard");
  const loadingSpinner = document.getElementById("loadingSpinner");
  const pdfExtractCard = document.getElementById("undertakingPdfContentCard");
  try {
    // Show loading spinner
    loadingSpinner.classList.remove("d-none");
    pdfViewerCard.classList.add("d-none");
    pdfExtractCard.classList.add("d-none");
    individualReportCard.classList.add("d-none");
    // Check if the selected file exists in state
    if (!selectedFile || !pdfContent) {
      throw new Error("PDF not found");
    }
    pdfViewer.src = e.target.value;
    pdfViewerCard.classList.remove("d-none");
    pdfExtractCard.classList.remove("d-none");
    // Highlight numbers and display PDF content in the undertaking section
    document.getElementById("undertakingPdfContent").innerHTML = highlightNumbers(pdfContent);

    // Generate initial table
    const table = filesUploaded.isUndertakingExcel
      ? generateExcelTable()
      : generateSingleTable(state.undertakingPdfs[selectedFile]);
    individualReportCard.classList.remove("d-none");
    document.getElementById("undertakingIndividualReport").innerHTML = table;
  } catch (error) {
    showError("Error handling PDF: " + error.message);
  } finally {
    // Hide loading spinner
    loadingSpinner.classList.add("d-none");
  }
});

//Table Rendering for Customer Data in CM Section
document.getElementById("customerPdfSelect").addEventListener("change", async (e) => {

  filesUploaded.isCustomerPdf=document.getElementById("customerPdfSelect").value !=="";
  const selectedFile = e.target.value;
  const individualReportCard = document.getElementById("customerIndividualReportCard");
  const loadingSpinner = document.getElementById("loadingSpinner");
  const pdfExtractCard = document.getElementById("customerPdfContentCard");
  const customerPdfViewerCard=document.getElementById("customerPdfViewerCard");
  const pdfViewerCustomer=document.getElementById("customerPdfViewer");

  try {
    // Show loading spinner
    loadingSpinner.classList.remove("d-none");
    // pdfViewerCard.classList.add("d-none");
    // pdfExtractCard.classList.add("d-none");
    // individualReportCard.classList.add("d-none");
    // Check if the selected file exists in state
    if (!selectedFile || !pdfContent) {
      throw new Error("PDF not found");
    }
    pdfViewerCustomer.src = e.target.value;
    // customerPdfViewerCard.classList.remove("d-none");
    // pdfExtractCard.classList.remove("d-none");
  } catch (error) {
    showError("Error handling PDF: " + error.message);
  } finally {
    // Hide loading spinner
    loadingSpinner.classList.add("d-none");
  }
});


document.getElementById("loanPdfSelect").addEventListener("change", async (e) => {
  filesUploaded.isCustomerLoanPdf=document.getElementById("loanPdfSelect").value !=="";
  const selectedFile = e.target.value;
  const pdfContent = state.loanPdfs[selectedFile]["Complete Extracted Text"] || "";
  const individualReportCard = document.getElementById("customerIndividualReportCard");
  const loadingSpinner = document.getElementById("loadingSpinner");
  const pdfExtractCard = document.getElementById("customerPdfContentCard");
  const customerPdfViewerCard=document.getElementById("customerPdfViewerCard");
  const pdfViewerCustomer=document.getElementById("customerPdfViewer");

  try {
    // Show loading spinner
    loadingSpinner.classList.remove("d-none");
    pdfViewerCard.classList.add("d-none");
    pdfExtractCard.classList.add("d-none");
    individualReportCard.classList.add("d-none");
    // Check if the selected file exists in state
    if (!selectedFile || !pdfContent) {
      throw new Error("PDF not found");
    }
    pdfViewerCustomer.src = e.target.value;
    customerPdfViewerCard.classList.remove("d-none");
    pdfExtractCard.classList.remove("d-none");

    // Highlight numbers and display PDF content in the undertaking section
    document.getElementById("customerPdfContent").innerHTML = highlightNumbers(pdfContent);

    // Generate initial table
    // const table = filesUploaded.isCustomerExcel
    //   ? generateExcelTable()
    //   : generateSingleTable(state.undertakingPdfs[selectedFile]);
    // individualReportCard.classList.remove("d-none");
    // document.getElementById("customerIndividualReport").innerHTML = table;
  } catch (error) {
    showError("Error handling PDF: " + error.message);
  } finally {
    // Hide loading spinner
    loadingSpinner.classList.add("d-none");
  }
})

document.getElementById("undertakingExcelSelect").addEventListener("change", async (e) => {
  filesUploaded.isUndertakingExcel = document.getElementById("undertakingExcelSelect").value !== "";
  const selectedFile = document.getElementById("undertakingPdfSelect").value;
  const pdfContent = state.undertakingPdfs[selectedFile]["Complete Extracted Text"] || "";
  const individualReportCard = document.getElementById("undertakingIndividualReportCard");

  try {
    // Show loading spinner
    loadingSpinner.classList.remove("d-none");
    individualReportCard.classList.add("d-none");

    // Check if the selected file exists in state
    if (!selectedFile || !pdfContent) {
      throw new Error("PDF not found");
    }
    document.getElementById("undertakingIndividualReportCard").classList.remove("d-none");
    const table = generateExcelTable();
    document.getElementById("undertakingIndividualReport").innerHTML = table;
  } catch (error) {
    showError("Error handling PDF: " + error.message);
  } finally {
    // Hide loading spinner
    loadingSpinner.classList.add("d-none");
  }
});

document.getElementById("customerExcelSelect").addEventListener("change", async (e) => {
  filesUploaded.isCustomerExcel=document.getElementById("customerExcelSelect").value !=="";
  const selectedFile = e.target.value;
  const individualReportCard = document.getElementById("customerIndividualReportCard");
  const loadingSpinner = document.getElementById("loadingSpinner");
  const pdfExtractCard = document.getElementById("customerPdfContentCard");
  const customerPdfViewerCard=document.getElementById("customerPdfViewerCard");
  const pdfViewerCustomer=document.getElementById("customerPdfViewer");

  if(filesUploaded.isCustomerExcel && filesUploaded.isCustomerLoanPdf && filesUploaded.isCustomerPdf){
    // Show loading spinner
    loadingSpinner.classList.remove("d-none");
    individualReportCard.classList.add("d-none");

    const table=generateLoanExcelTable();
    individualReportCard.classList.remove("d-none");
    document.getElementById("customerIndividualReport").innerHTML = table;
  }
})
// ------------------------------------------Process Buttons-------------------------------------------

document.getElementById("undertakingProcess").addEventListener("click", async () => {

  document.getElementById("undertakingOutput").innerHTML = `<div class="spinner-border text-primary" role="status">
</div>`;

  try {
    const { summaryTable, detailedTable } = generateFinalUndertakingTable();
    const undertakingOutput = document.getElementById("undertakingOutput");

    // Clear any existing content in the output div
    undertakingOutput.innerHTML = "";

    // Insert the summary table
    undertakingOutput.innerHTML += "<h3>Summary of Incorrect Data</h3>" + summaryTable;

    // Insert the detailed table
    undertakingOutput.innerHTML += "<h3>Detailed Comparison of Accounts</h3>" + detailedTable;
  } catch (error) {
    showError("Processing failed: " + error.message);
  } finally {
    toggleLoading(false);
  }
});

document.getElementById("customerProcess").addEventListener("click", async () => {
  toggleLoading(true);
  try {
    const table=generateCustomerFinalTable();
    if (!selectedPdf || !state.customerExcel || Object.keys(state.loanPdfs).length === 0) {
      showError("Please upload all required files");
      return;
    }
    document.getElementById("customerOutput").innerHTML = comparison;
  } catch (error) {
    showError("Processing failed: " + error.message);
  } finally {
    toggleLoading(false);
  }
});

// ---------------------------------------File Handling--------------------------------------------------

// Handle Excel uploads
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

    // Optionally, save the data to localStorage for persistence
    localStorage.setItem(CACHE_KEY_EXCEL, JSON.stringify(customerDataExcel));

    return excelContent; // Return the parsed data
  } catch (error) {
    showError("Error loading Excel file:", error);
    return null;
  }
}
// --------------------------------------Event Listeners-----------------------------------------------------



async function loadFiles() {
  const undertakingPdfSelect = document.getElementById("undertakingPdfSelect");
  const undertakingExcelSelect = document.getElementById("undertakingExcelSelect");
  const customerPdfSelect = document.getElementById("customerPdfSelect");
  const customerExcelSelect = document.getElementById("customerExcelSelect");
  const loanPdfSelect = document.getElementById("loanPdfSelect");
  const extractedTexts = state.undertakingPdfs;
  const extractedLoanTexts = state.loanPdfs;
  const excelDataCache = state.undertakingExcel;

  try {
    // Show loading indicator
    toggleLoading(true);

    // Fetch the config.json file
    const response = await fetch("config.json");
    if (!response.ok) {
      throw new Error("Failed to fetch configuration.");
    }

    // Parse the JSON data
    const { pdfs: pdfConfig, excel: excelConfig,loan:loanConfig } = await response.json(); // Separate PDFs and Excel files


    // Populate the PDF dropdown
    pdfConfig.forEach((pdf) => {
      const option = document.createElement("option");
      option.value = pdf.path; // Path will be used for loading
      option.textContent = pdf.name; // Name displayed in the dropdown
      undertakingPdfSelect.appendChild(option);

      const customerOption = option.cloneNode(true);
      customerPdfSelect.appendChild(customerOption);
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

    // // Concatenate all text for "all PDFs" option
    // extractedTexts["all"] = Object.values(extractedTexts)
    //   .filter((text) => typeof text === "object" && text["Complete Extracted Text"]) // Ensure it's an object and has "Complete Extracted Text"
    //   .map((text) => text["Complete Extracted Text"]) // Extract "Complete Extracted Text"
    //   .join("\n\n---\n\n"); // Join with separators

    // Save PDF data to local storage for future use
    localStorage.setItem(CACHE_KEY, JSON.stringify(extractedTexts));

    // Populate the Excel dropdown
    excelConfig.forEach((excel) => {
      const option = document.createElement("option");
      option.value = excel.path; // Path will be used for loading
      option.textContent = excel.name; // Name displayed in the dropdown
      undertakingExcelSelect.appendChild(option);

      const customerOption = option.cloneNode(true);
      customerExcelSelect.appendChild(customerOption);
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

    // extractedLoanTexts["all"] = Object.values(extractedLoanTexts)
    // .filter((text) => typeof text === "object" && text["Complete Extracted Text"]) // Ensure it's an object and has "Complete Extracted Text"
    // .map((text) => text["Complete Extracted Text"]) // Extract "Complete Extracted Text"
    // .join("\n\n---\n\n"); // Join with separators

    console.log("User Data:",state.undertakingPdfs);
    console.log("Loan PDF Data:",state.loanPdfs);
    console.log("Excel Data:",state.undertakingExcel);
    // Save Excel data to local storage for future use
    localStorage.setItem(CACHE_KEY_LOAN, JSON.stringify(extractedLoanTexts));
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
          Authorization:
            `Bearer ${token}`,
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
Annual Percentage Rate (APR),
Finance Charge,
Amount Financed,
Total of Payments,
EMI Amount,
Number of Payments,
Returned Payment Charges,
Origination Fee,
Booking Date,
Late Fee Charges
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
