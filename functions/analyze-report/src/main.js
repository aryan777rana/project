import { webcrypto } from 'crypto';
globalThis.crypto = webcrypto;
import { Client, Databases, Storage } from 'node-appwrite';
import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';

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

        log("Updating Appwrite database to mark document as Completed...");
        await databases.updateDocument('medical_data', 'reports', reportId, {
            status: "Completed",
            extractedText: content.substring(0, 65000), // Prevent exceeding Appwrite default attribute length
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
