import { webcrypto } from 'crypto';
globalThis.crypto = webcrypto;
import { Client, Databases, Storage } from 'node-appwrite';
import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';

const MAX_EXTRACTED_TEXT_LENGTH = 65000;
const MAX_SUMMARY_SOURCE_LENGTH = 12000;
const MAX_PRIORITY_KEY_VALUES = 40;
const MAX_PRIORITY_TABLE_LINES = 60;

const PRIORITY_MEDICAL_TERMS = [
    'blood group',
    'blood type',
    'glucose',
    'sugar',
    'fasting',
    'hba1c',
    'a1c',
    'hemoglobin',
    'haemoglobin',
    'wbc',
    'rbc',
    'platelet',
    'platelets',
    'cholesterol',
    'hdl',
    'ldl',
    'triglyceride',
    'creatinine',
    'urea',
    'bun',
    'bilirubin',
    'sgpt',
    'sgot',
    'alt',
    'ast',
    'alkaline phosphatase',
    'albumin',
    'globulin',
    'protein',
    'sodium',
    'potassium',
    'chloride',
    'calcium',
    'vitamin',
    'tsh',
    't3',
    't4',
    'thyroid',
    'crp',
    'esr',
    'uric acid',
    'hiv',
    'hbsag',
    'malaria',
    'dengue',
    'covid',
    'bp',
    'blood pressure',
    'pulse',
    'oxygen',
    'spo2'
];

function getMedicalPriorityScore(text) {
    const normalized = (text || '').toLowerCase();
    if (!normalized.trim()) {
        return 0;
    }

    let score = 0;

    for (const term of PRIORITY_MEDICAL_TERMS) {
        if (normalized.includes(term)) {
            score += 10;
        }
    }

    if (/\b(high|low|positive|negative|reactive|non-reactive|abnormal|normal)\b/.test(normalized)) {
        score += 4;
    }

    if (/\b\d+(\.\d+)?\b/.test(normalized)) {
        score += 3;
    }

    if (/\b\d+(\.\d+)?\s*(mg\/dl|g\/dl|mmol\/l|iu\/l|u\/l|cells|%|ng\/ml|pg\/ml|meq\/l)\b/i.test(normalized)) {
        score += 6;
    }

    return score;
}

function buildPriorityKeyValues(keyValues) {
    return (keyValues || [])
        .map(({ key, value }) => {
            const line = `${key || "Unknown field"}: ${value || "Not detected"}`;
            return {
                line,
                score: getMedicalPriorityScore(line)
            };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_PRIORITY_KEY_VALUES)
        .map((item) => item.line)
        .join('\n');
}

function buildPriorityTablePreview(tables) {
    const prioritizedRows = [];

    (tables || []).forEach((table, tableIndex) => {
        const rowMap = new Map();

        (table.cells || []).forEach((cell) => {
            const rowIndex = cell.row;
            if (!rowMap.has(rowIndex)) {
                rowMap.set(rowIndex, []);
            }
            rowMap.get(rowIndex).push(cell);
        });

        for (const [rowIndex, rowCells] of rowMap.entries()) {
            const orderedCells = rowCells
                .slice()
                .sort((a, b) => a.col - b.col)
                .map((cell) => cell.text || '');

            const line = orderedCells.join(' | ').trim();
            prioritizedRows.push({
                line: `Table ${tableIndex + 1}, Row ${rowIndex + 1}: ${line}`,
                score: getMedicalPriorityScore(line)
            });
        }
    });

    return prioritizedRows
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_PRIORITY_TABLE_LINES)
        .map((item) => item.line)
        .join('\n');
}

async function generateGeminiSummary({ content, structuredData, log }) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        log("Skipping Gemini summary because GEMINI_API_KEY is not configured.");
        return {
            status: "skipped",
            summary: "",
            model: null,
            error: "Missing GEMINI_API_KEY"
        };
    }

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const sourceText = (content || "").slice(0, MAX_SUMMARY_SOURCE_LENGTH);
    const keyValues = buildPriorityKeyValues(structuredData.keyValues);
    const tablePreview = buildPriorityTablePreview(structuredData.tables);

    const prompt = [
        "Generate a concise summary in plain language for a patient-facing health app.",
        "Review the extracted key-value pairs, raw text, and especially the table values before writing the summary.",
        "If table values suggest notable patterns, trends, abnormal-looking ranges, or repeated measurements, mention that as a careful observation.",
        "Only use information supported by the extracted data. If details are unclear, say that the source is unclear.",
        "Do not invent facts. Do not present observations as a diagnosis.",
        "Use these sections exactly:",
        "Overview:",
        "Important details:",
        "Potential follow-up items:",
        "Consult your doctor:",
        "In the final section, include a short sentence telling the user to consult with their doctor for medical interpretation.",
        "",
        "Extracted key-value pairs:",
        keyValues || "None detected.",
        "",
        "Extracted tables:",
        tablePreview || "None detected.",
        "",
        "Extracted raw text:",
        sourceText || "No text extracted."
    ].join('\n');

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [
                        {
                            text: [
                                "You are a medical document summarization assistant for a patient-facing application.",
                                "Your job is to summarize extracted report data clearly and cautiously.",
                                "Inspect tables carefully and try to deduce meaningful observations from numeric values, labels, and trends when they are supported by the data.",
                                "Do not invent facts or provide a diagnosis.",
                                "Always end with a brief note telling the user to consult with their doctor."
                            ].join(' ')
                        }
                    ]
                },
                contents: [
                    {
                        parts: [{ text: prompt }]
                    }
                ],
                generationConfig: {
                    temperature: 0.6,
                    topP: 0.8,
                    maxOutputTokens: 600
                }
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini request failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const summary = result.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join('\n')
        .trim();

    if (!summary) {
        throw new Error("Gemini returned an empty summary.");
    }

    return {
        status: "completed",
        summary,
        model,
        error: null
    };
}

export default async ({ req, res, log, error }) => {
    let payload = {};
    if (req.bodyRaw) {
        try {
            payload = JSON.parse(req.bodyRaw);
        } catch (e) {
            error("Failed to parse JSON payload.");
        }
    }
    
    // Support either Appwrite Event Document Payload or Direct HTTP execution payload
    const reportId = payload.$id || payload.reportId;
    const fileId = payload.fileId;

    if (!fileId || !reportId) {
        error(`Missing fileId (${fileId}) or reportId (${reportId})`);
        return res.json({ success: false, error: "Missing required fields" }, 400);
    }

    log(`Beginning processing for Report ID: ${reportId}, File ID: ${fileId}`);

    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1')
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || '69d2a9900032fd99f3b7')
        .setKey(process.env.APPWRITE_API_KEY);

    const storage = new Storage(client);
    const databases = new Databases(client);

    try {
        log("Downloading file from Appwrite Storage...");
        const fileBuffer = await storage.getFileDownload('reports_bucket', fileId);

        if (!process.env.AZURE_ENDPOINT || !process.env.AZURE_API_KEY) {
            throw new Error("Missing Azure Configuration Variables.");
        }

        log("Connecting to Microsoft Azure Document Intelligence...");
        const azureClient = new DocumentAnalysisClient(
            process.env.AZURE_ENDPOINT,
            new AzureKeyCredential(process.env.AZURE_API_KEY)
        );

        log("Submitting file stream to prebuilt-layout model...");
        const poller = await azureClient.beginAnalyzeDocument("prebuilt-layout", Buffer.from(fileBuffer));
        const { content, tables, keyValuePairs } = await poller.pollUntilDone();

        log("Azure Analysis completed successfully!");

        const structuredData = {
            summary: "Extracted structure from Document Intelligence",
            tablesCount: tables ? tables.length : 0,
            tables: tables ? tables.map(t => ({
                rowCount: t.rowCount,
                columnCount: t.columnCount,
                cells: t.cells.map(c => ({ row: c.rowIndex, col: c.columnIndex, text: c.content }))
            })) : [],
            keyValues: keyValuePairs ? keyValuePairs.map(kv => ({
                key: kv.key?.content || "",
                value: kv.value?.content || ""
            })) : []
        };

        let geminiResult;

        try {
            log("Generating Gemini summary from extracted medical data...");
            geminiResult = await generateGeminiSummary({ content, structuredData, log });
            log(`Gemini summary status: ${geminiResult.status}`);
        } catch (geminiError) {
            error(`Gemini summary failed: ${geminiError.message}`);
            geminiResult = {
                status: "failed",
                summary: "",
                model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
                error: geminiError.message
            };
        }

        structuredData.geminiSummary = geminiResult.summary;
        structuredData.geminiSummaryStatus = geminiResult.status;
        structuredData.geminiModel = geminiResult.model;
        structuredData.geminiError = geminiResult.error;

        log("Updating Appwrite database to mark document as Completed...");
        await databases.updateDocument('medical_data', 'reports', reportId, {
            status: "Completed",
            extractedText: (content || "").substring(0, MAX_EXTRACTED_TEXT_LENGTH),
            structuredData: JSON.stringify(structuredData)
        });

        log("Process entirely complete!");
        return res.json({ success: true, message: "Analysis complete", reportId });
        
    } catch (err) {
        error(`Failed to process report: ${err.message}`);
        
        try {
            await databases.updateDocument('medical_data', 'reports', reportId, {
                status: "Failed"
            });
        } catch (dbErr) {
            error("Could not update database status to Failed.");
        }

        return res.json({ success: false, error: err.message }, 500);
    }
};
