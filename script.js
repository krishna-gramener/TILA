import { Marked } from "https://cdn.jsdelivr.net/npm/marked@13/+esm";
import * as pdfjs from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9/+esm";
pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9/build/pdf.worker.min.mjs";

const marked = new Marked();
const pdfViewerCard = document.getElementById("undertakingPdfViewerCard");
const pdfViewer = document.getElementById("undertakingPdfViewer");
const CACHE_KEY = "pdfExtractCache";
const CACHE_KEY_EXCEL = "excelData";
const state = {
  undertakingPdfs: {},
  customerPdfs: {},
  loanPdfs: {},
  undertakingExcel: {}, // Initialized as an empty object
  customerExcel: {}, // Initialized as an empty object
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
// Load cache from localStorage
try {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    state.undertakingPdfs = JSON.parse(cached);
  }
} catch (error) {
  console.error("Cache loading error:", error);
}

try {
  const cached = localStorage.getItem(CACHE_KEY_EXCEL);
  if (cached) {
    state.undertakingExcel = JSON.parse(cached);
  }
} catch (error) {
  console.error("Cache loading error:", error);
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
      console.log("JSONData: ", jsonData);
      return jsonData; // Logs the parsed JSON object
    } catch (error) {
      console.error("Invalid JSON:", error);
    }
  } else {
    console.error("No JSON block found in the markdown.");
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
    <table>
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
    console.error("PDF or Excel data is missing.");
    return;
  }

  // Define the fields to compare and their mappings
  const fieldMappings = {
    Borrower: "Borrower",
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
    console.error("No matching row found in Excel data for the provided Loan ID.");
    return `<p>No matching data found for Loan ID: ${loanId}</p>`;
  }

  // Start creating the HTML table
  let table = `
    <table>
      <thead>
        <tr>
          <th>Field</th>
          <th>TILA Data</th>
          <th>Excel Data</th>
          <th>Mismatch</th>
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
    const mismatch =
      typeof pdfValue === "number" && typeof excelValue === "number"
        ? pdfValue.toFixed(2) != excelValue.toFixed(2) // Numeric comparison
        : typeof pdfValueRaw === "string" && typeof excelValue === "string"
        ? pdfValueRaw.trim() !== excelValue.trim() // String comparison (case-sensitive, original format)
        : pdfValue != excelValue;

    // Add a row to the table
    table += `
      <tr>
        <td>${pdfField}</td>
        <td>${pdfValueRaw}</td>
        <td>${excelValue}</td>
        <td>${mismatch ? "Y" : "N"}</td>
      </tr>`;
  }

  // Close the table
  table += `
      </tbody>
    </table>`;

  // Return the table
  return table;
}

function generateMultipleTable() {
  const table = ``;
  return table;
}

// ----------------------------------------------LLM Function---------------------------------------------------
async function processWithLLM(systemPrompt, userPrompt) {
  toggleLoading(true);
  try {
    const response = await fetch("https://llmfoundry.straive.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const result = await response.json();
    console.log(result);
    return result.choices?.[0]?.message?.content || "No data generated";
  } catch (error) {
    showError("Failed to process with LLM: " + error.message);
    return "";
  } finally {
    toggleLoading(false);
  }
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

// --------------------------------------Pdf Uploads Handling ------------------------------------------
document.getElementById("customerPdfUpload").addEventListener("change", async (e) => {
  await handlePdfUpload(
    e.target.files,
    document.getElementById("customerOutput"),
    document.getElementById("customerPdfSelect"),
    state.customerPdfs,
    "customer_data"
  );
});

document.getElementById("loanPdfUpload").addEventListener("change", async (e) => {
  await handlePdfUpload(
    e.target.files,
    document.getElementById("undertakingPdfContent"),
    document.getElementById("undertakingPdfSelect"),
    state.loanPdfs,
    "loan_data"
  );
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
    console.log("Individual Report Data :", state.undertakingPdfs[selectedFile]);
    document.getElementById("undertakingIndividualReport").innerHTML = table;
  } catch (error) {
    console.error("Error handling PDF: " + error.message);
  } finally {
    // Hide loading spinner
    loadingSpinner.classList.add("d-none");
  }
});

//Table Rendering for Customer Data in CM Section
document.getElementById("customerPdfSelect").addEventListener("change", async (e) => {
  const content = state.customerPdfs[e.target.value] || "";
  document.getElementById("customerPdfContent").innerHTML = highlightNumbers(content);
  // Generate initial table
  const systemPrompt = `> You are an expert loan analyzer.Draw key terms from the data in a key value format.

    > Data should have the following :-
1)Creditor
2) Borrower
3) Account Number
4) Annual Percentage Rate (APR)
5) Finance Charge
6) Amount Financed
7)Total of Payments
8) Monthly Payment Amount
9) Number of Payments
10) Returned Payment Fee
11) Origination Fee
12) Late Charges
13) Prepayment Penalty
14) Refund on Finance Charge upon Prepayment
15) Acknowledgment	Borrower acknowledges receipt of the Truth in Lending Statement
Return the data in json format only.
    `;
  const userprompt = `\n\nUser Data = ${content}\n\n`;
  const data = await processWithLLM(systemPrompt, userprompt);
  console.log("Processed Individual Customer Data : ", data);
  let jsonData = extractJSON(data);
  const table = generateSingleTable(jsonData);
  document.getElementById("customerOutput").innerHTML = table;
});

// ------------------------------------------Process Buttons-------------------------------------------

document.getElementById("undertakingProcess").addEventListener("click", async () => {
  document.getElementById("undertakingOutput").innerHTML = `<div class="spinner-border text-primary" role="status">
</div>`;

  try {
  } catch (error) {
    showError("Processing failed: " + error.message);
  } finally {
    toggleLoading(false);
    console.log("toggleLoading Stopped");
  }
});

document.getElementById("customerProcess").addEventListener("click", async () => {
  toggleLoading(true);
  try {
    const selectedPdf = document.getElementById("customerPdfSelect").value;
    if (!selectedPdf || !state.customerExcel || Object.keys(state.loanPdfs).length === 0) {
      showError("Please upload all required files");
      return;
    }
    const systemPrompt = `You are an expert loan document analyzer.
    Analyze loan data from PDFs and compare with Excel data accurately.
    Map the data carefully.

2) There should be 3 tables in output :-

Table 1 contains the following columns :-
Total Account checked,
Accounts with incorrect data,
Number of Incorrect on APR,
Number of Incorrect on Financial Charge,
Number of Incorrect on Amount Financed,
Number of Incorrect on Total Payment,
Number of Incorrect on Number of Payment,
Number of Incorrect on Amount of Payment,
Number of Incorrect in Origination Fee

Table 2 contains the following columns Heading is Incorrect Account Details:-
    Serial Number,
    Loan Id,
    Booking Date,
    Payment Month Date,
    Late Fees Charges (per loan pdf),
    Late Fees charges (per customer pdf),
    Late Fees charges (per excel)

Table 3 contains the following columns Heading is Incorrect Account Details:-
    Serial Number,
    Loan Id,
    Booking Date,
    Payment Month Date,
    Returned payment Charge (per loan pdf),
    Returned payment Charge (per customer pdf),
    Returned payment Charge (per excel)

3) Provide a detailed summary of findings Summary should be text only.`;

    const userPrompt = `Compare the following data:\nCustomer PDF: ${state.customerPdfs["all"]}\nLoan PDFs: ${state.loanPdfs["all"]}\nExcel: ${state.customerExcel}`;
    const comparison = await processWithLLM(systemPrompt, userPrompt);
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
    console.log("Customer Data From Excel :", state.undertakingExcel);

    // Optionally, save the data to localStorage for persistence
    localStorage.setItem(CACHE_KEY_EXCEL, JSON.stringify(customerDataExcel));

    return excelContent; // Return the parsed data
  } catch (error) {
    console.error("Error loading Excel file:", error);
    return null;
  }
}

// Handle Excel uploads
async function handleExcelUpload(file, stateKey) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  const excelContent = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    return {
      sheetName: sheetName,
      data: XLSX.utils.sheet_to_json(sheet, { header: 1 }), // Ensure data extraction as an array of arrays
    };
  });

  state[stateKey] = excelContent;
}

// Handle PDF uploads
async function handlePdfUpload(files, container, select, storage, fileName) {
  toggleLoading(true);
  let all = "";
  try {
    const pdfs = JSON.parse(localStorage.getItem("pdfs") || "{}");

    for (const file of files) {
      if (!file.type.includes("pdf")) {
        console.log(`${file.name} is not a PDF file`);
        continue;
      }

      // Process the PDF content
      const text = await processPdf(file);
      storage[file.name] = text;
      all += text;

      // Add option to select dropdown
      if (fileName === "customer_data") {
        const option = document.createElement("option");
        option.value = file.name;
        option.textContent = file.name;
        select.appendChild(option);
        // Read the PDF file as Base64 and store it locally
        const reader = new FileReader();
        await new Promise((resolve, reject) => {
          reader.onload = () => {
            pdfs[file.name] = reader.result; // Store the Base64 representation
            resolve();
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
    }

    // Save all PDFs in localStorage
    if (fileName === "customer_data") {
      localStorage.setItem("pdfs", JSON.stringify(pdfs));
    }
    storage["all"] = all;
    console.log(pdfs);
    console.log(state.undertakingPdfs);
    console.log("PDFs uploaded and stored locally successfully!", "success");
  } catch (error) {
    showError("Failed to upload PDF: " + error.message);
  } finally {
    toggleLoading(false);
  }
}
// Process PDF
async function processPdf(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument(arrayBuffer).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(" ");
      fullText += pageText + "\n";
    }

    return fullText;
  } catch (error) {
    console.error("Failed to process PDF: " + error.message);
    return "";
  }
}

// --------------------------------------Event Listeners-----------------------------------------------------
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
    console.error("Error handling PDF: " + error.message);
  } finally {
    // Hide loading spinner
    loadingSpinner.classList.add("d-none");
  }
});

document.getElementById("customerExcelUpload").addEventListener("change", (e) => {
  if (e.target.files[0]) handleExcelUpload(e.target.files[0], "customerExcel");
});

async function loadFiles() {
  const undertakingPdfSelect = document.getElementById("undertakingPdfSelect");
  const undertakingExcelSelect = document.getElementById("undertakingExcelSelect");
  const extractedTexts = state.undertakingPdfs;
  const excelDataCache = state.undertakingExcel;

  try {
    // Show loading indicator
    toggleLoading(true);

    // Fetch the config.json file
    const response = await fetch("config.json");
    console.log(response);
    if (!response.ok) {
      throw new Error("Failed to fetch configuration.");
    }

    // Parse the JSON data
    const { pdfs: pdfConfig, excel: excelConfig } = await response.json(); // Separate PDFs and Excel files
    console.log("pdfConfig", pdfConfig);
    console.log("excelConfig", excelConfig);

    // Populate the PDF dropdown
    pdfConfig.forEach((pdf) => {
      const option = document.createElement("option");
      option.value = pdf.path; // Path will be used for loading
      option.textContent = pdf.name; // Name displayed in the dropdown
      undertakingPdfSelect.appendChild(option);
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

    // Concatenate all text for "all PDFs" option
    extractedTexts["all"] = Object.values(extractedTexts)
      .filter((text) => typeof text === "object" && text["Complete Extracted Text"]) // Ensure it's an object and has "Complete Extracted Text"
      .map((text) => text["Complete Extracted Text"]) // Extract "Complete Extracted Text"
      .join("\n\n---\n\n"); // Join with separators

    // Save PDF data to local storage for future use
    localStorage.setItem(CACHE_KEY, JSON.stringify(extractedTexts));

    // Populate the Excel dropdown
    excelConfig.forEach((excel) => {
      const option = document.createElement("option");
      option.value = excel.path; // Path will be used for loading
      option.textContent = excel.name; // Name displayed in the dropdown
      undertakingExcelSelect.appendChild(option);
    });

    // Preload and cache Excel data (optional)
    for (const excel of excelConfig) {
      const excelData = await loadExcelFiles(excel.path, "undertakingExcel"); // Function to parse Excel data
    }
    // Save Excel data to local storage for future use
  } catch (error) {
    console.error("Excel Error:", error.message);
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
    console.log(base64Pdf);
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
    console.log(data.candidates?.[0]?.content?.parts?.[0]?.text);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error) {
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

async function extractExcelInfoUsingGemini(excelData) {
  try {
    console.log("Excel Data", excelData);
    const response = await fetch(
      "https://llmfoundry.straive.com/gemini/v1beta/models/gemini-1.5-flash-latest:generateContent",
      {
        method: "POST",
        headers: {
          Authorization:
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImtyaXNobmEua3VtYXJAZ3JhbWVuZXIuY29tIn0.QY0QNLADfGARpZvcew8DJgrtMtdxJ8NHUn9_qnSiWEM:llmproxy-playground",
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
    console.log(data.candidates?.[0]?.content?.parts?.[0]?.text);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error) {
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

// Initialize
await loadFiles().catch((error) => showError(error.message));
