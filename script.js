import { Marked } from "https://cdn.jsdelivr.net/npm/marked@13/+esm";
import * as pdfjs from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4/+esm";
pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.worker.min.mjs";

const marked = new Marked();
const pdfViewerCard = document.getElementById("pdfViewerCard");
const pdfViewer = document.getElementById("pdfViewer");
const state = {
  undertakingPdfs: {},
  customerPdfs: {},
  loanPdfs: {},
  undertakingExcel: null,
  customerExcel: null,
};

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

function generateSingleCard(data) {
  let table = `
  <table class="table table-striped">
  <thead>
  <tr>
  <th>Field</th>
  <th>Details</th>
  </tr>
  </thead>
  <tbody>
  `;

  for (const [key, value] of Object.entries(data)) {
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

function generateMultipleCards() {
  const table = ``;
  return table;
}

// Process with LLM
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

// Event Listeners
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

document.getElementById("undertakingPdfUpload").addEventListener("change", async (e) => {
  await handlePdfUpload(
    e.target.files,
    document.getElementById("undertakingPdfContent"),
    document.getElementById("undertakingPdfSelect"),
    state.undertakingPdfs,
    "customer_data"
  );
});

document.getElementById("customerPdfUpload").addEventListener("change", async (e) => {
  await handlePdfUpload(
    e.target.files,
    document.getElementById("customerOutput"),
    document.getElementById("customerPdfSelect"),
    state.customerPdfs,
    "customer_data"
  );
});

//Table Rendering for Customer Data in undertaking Section
document.getElementById("undertakingPdfSelect").addEventListener("change", async (e) => {
  const selectedFile = e.target.value;
  const pdfContent = state.undertakingPdfs[selectedFile] || "";
  const loadingSpinner = document.getElementById("loadingSpinner");

  try {
    // Show loading spinner
    loadingSpinner.classList.remove("d-none");
    pdfViewerCard.classList.add("d-none");

    // Check if the selected file exists in state
    // if (!selectedFile || !pdfContent) {
    //   throw new Error("PDF not found");
    // }

    // Highlight numbers and display PDF content in the undertaking section
    // document.getElementById("undertakingPdfContent").innerHTML = highlightNumbers(pdfContent);

    // Generate initial table
    const systemPrompt = `You are an expert loan analyzer. Draw key insights from the data and only present in a structured table.

    > Data should have the following:
1) Creditor
2) Borrower
3) Account Number
4) Annual Percentage Rate (APR)
5) Finance Charge
6) Amount Financed
7) Total of Payments
8) Monthly Payment Amount
9) Number of Payments
10) Returned Payment Fee
11) Origination Fee
12) Late Charges
13) Prepayment Penalty
14) Refund on Finance Charge upon Prepayment
15) Acknowledgment - Borrower acknowledges receipt of the Truth in Lending Statement

Should be a vertical table.`;

    const table = await processWithLLM(systemPrompt, pdfContent);
    document.getElementById("undertakingOutput").innerHTML = marked.parse(table);

    // Show PDF in the PDF viewer
    const pdfs = JSON.parse(localStorage.getItem("pdfs") || "{}");
    const pdfData = pdfs[selectedFile];

    if (!pdfData) {
      throw new Error("PDF data not found in local storage");
    }

    // Create a blob URL for the PDF and set it as the viewer source
    const blob = await fetch(pdfData).then((r) => r.blob());
    const blobUrl = URL.createObjectURL(blob);

    pdfViewer.src = blobUrl;
    pdfViewerCard.classList.remove("d-none");
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
  const jsonPattern = /```json([\s\S]*?)```/;
  const match = data.match(jsonPattern);
  console.log("match:", match);
  let jsonData = {};
  if (match) {
    // Step 2: Parse the JSON string to a JavaScript object
    try {
      jsonData = JSON.parse(match[1].trim());
      console.log("JSONData: ", jsonData); // Logs the parsed JSON object
    } catch (error) {
      console.error("Invalid JSON:", error);
    }
  } else {
    console.error("No JSON block found in the markdown.");
  }
  const table = generateSingleCard(jsonData);
  document.getElementById("customerOutput").innerHTML = table;
});

document.getElementById("undertakingProcess").addEventListener("click", async () => {
  toggleLoading(true);
  try {
    const selectedPdf = document.getElementById("undertakingPdfSelect").value;
    if (!selectedPdf || !state.undertakingExcel) {
      showError("Please select both PDF and Excel file");
      return;
    }

    const userPrompt = `Compare the following data:\nPDF: ${state.undertakingPdfs["all"]}\nExcel: ${JSON.stringify(
      state.undertakingExcel
    )}`;
    const systemPrompt = `1) You are a expert loan document analyzer.Analyze loan data from PDFs and compare with Excel data accurately.
2) There should be 2 tables in output :-

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
Borrower Name,
Application Number,
Loan Id,
Booking Date,
Orignation fee charge in pdf,
Orignation fee charge in excel

3) Provide a detailed summary of findings Summary should be text only.`;

    const comparison = await processWithLLM(systemPrompt, userPrompt);
    console.log("comparison: ", comparison);
    document.getElementById("undertakingOutput").innerHTML = marked.parse(comparison);
    console.log("Excel Data : ", state.undertakingExcel);
    console.log("pdf Data : ", state.undertakingPdfs);
  } catch (error) {
    showError("Processing failed: " + error.message);
  } finally {
    toggleLoading(false);
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
    const systemPrompt = `You are an expert loan document analyzer.Analyze loan data from PDFs and compare with Excel data accurately.
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

document.getElementById("undertakingExcelUpload").addEventListener("change", (e) => {
  if (e.target.files[0]) handleExcelUpload(e.target.files[0], "undertakingExcel");
});

document.getElementById("customerExcelUpload").addEventListener("change", (e) => {
  if (e.target.files[0]) handleExcelUpload(e.target.files[0], "customerExcel");
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
    //console.log("Here");
    console.error("Failed to process PDF: " + error.message);
    return "";
  }
}
