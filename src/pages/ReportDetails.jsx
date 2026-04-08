import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { databases, storage, functions } from "../lib/appwrite";
import { motion } from "framer-motion";

export default function ReportDetails() {
    const { id } = useParams();
    const [report, setReport] = useState(null);
    const [data, setData] = useState(null);
    const [imageUrl, setImageUrl] = useState("");
    const [error, setError] = useState("");
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryMessage, setSummaryMessage] = useState("");

    async function fetchDetails() {
        try {
            const doc = await databases.getDocument("medical_data", "reports", id);
            setReport(doc);
            
            if (doc.fileId) {
                const previewUrl = await storage.getFileView("reports_bucket", doc.fileId);
                setImageUrl(previewUrl);
            }

            if (doc.structuredData) {
                setData(JSON.parse(doc.structuredData));
            } else {
                setData(null);
            }
        } catch (err) {
            setError(err.message);
        }
    }

    useEffect(() => {
        fetchDetails();
    }, [id]);

    useEffect(() => {
        if (!summaryLoading || !id) {
            return undefined;
        }

        const intervalId = window.setInterval(async () => {
            try {
                const doc = await databases.getDocument("medical_data", "reports", id);
                const nextData = doc.structuredData ? JSON.parse(doc.structuredData) : null;
                const nextSummary = nextData?.geminiSummary?.trim();
                const nextSummaryStatus = nextData?.geminiSummaryStatus;

                setReport(doc);
                setData(nextData);

                if (nextSummary) {
                    setSummaryLoading(false);
                    setSummaryMessage("Summary generated successfully.");
                } else if (nextSummaryStatus === 'failed') {
                    setSummaryLoading(false);
                    setSummaryMessage(nextData?.geminiError || "Summary generation failed. Please try again later.");
                } else if (nextSummaryStatus === 'skipped') {
                    setSummaryLoading(false);
                    setSummaryMessage("Summary generation is not enabled for this function right now.");
                }
            } catch (pollError) {
                setSummaryLoading(false);
                setSummaryMessage(pollError.message);
            }
        }, 4000);

        return () => window.clearInterval(intervalId);
    }, [summaryLoading, id]);

    async function handleGenerateSummary() {
        if (!report?.$id || !report?.fileId || summaryLoading) {
            return;
        }

        setSummaryLoading(true);
        setSummaryMessage("Summary generation started. This page will refresh automatically.");

        try {
            await functions.createExecution(
                "analyze-report",
                JSON.stringify({
                    reportId: report.$id,
                    fileId: report.fileId
                }),
                true
            );
        } catch (executionError) {
            setSummaryLoading(false);
            setSummaryMessage(executionError.message);
        }
    }

    if (error) {
        return (
            <div className="centered-page">
                <div className="glass-card" style={{ maxWidth: '600px' }}>
                    <div className="text-error">{error}</div>
                    <Link to="/" className="btn btn-secondary">Go Back</Link>
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="centered-page">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ width: '3rem', height: '3rem', border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%' }} />
            </div>
        );
    }

    const geminiSummary = data?.geminiSummary?.trim();
    const geminiSummaryStatus = data?.geminiSummaryStatus;
    const geminiError = data?.geminiError;
    const canRetrySummary = report.status === 'Completed' && !geminiSummary;

    return (
        <motion.div 
            className="dashboard-container"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4 }}
            style={{ maxWidth: '1200px' }}
        >
            <div className="glass-header" style={{ borderRadius: '20px', marginBottom: '2rem' }}>
                <div>
                    <h1 className="title" style={{ marginBottom: '0.25rem' }}>{report.fileName}</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Status: <span style={{fontWeight:600}} className={report.status === 'Completed' ? 'text-link' : ''}>{report.status}</span> &bull; Extracted on {new Date(report.reportDate).toLocaleDateString()}</p>
                </div>
                <div>
                    <Link to="/" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                        &larr; Back to Dashboard
                    </Link>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div className="glass-card" style={{ flex: '1 1 400px', padding: '1.5rem', alignSelf: 'flex-start' }}>
                    <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '0.5rem' }}>Original Document</h3>
                    {imageUrl ? (
                        <img 
                            src={imageUrl} 
                            alt={report.fileName} 
                            style={{ width: '100%', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)' }} 
                        />
                    ) : (
                        <div className="empty-state">No Preview Available</div>
                    )}
                </div>

                <div className="glass-card" style={{ flex: '2 1 600px', padding: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '0.5rem' }}>
                        Analyzed Azure Document Data
                    </h3>
                    
                    {report.status !== 'Completed' ? (
                        <div className="empty-state">
                            <motion.div 
                                animate={{ rotate: 360 }} 
                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                style={{ display: 'inline-block', width: '2rem', height: '2rem', border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', marginBottom: '1rem' }}
                            />
                            <p>Azure Document Intelligence is currently processing this document. Check back soon!</p>
                        </div>
                    ) : data ? (
                        <div>
                            <div style={{ marginBottom: '2rem', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.16)', borderRadius: '14px', padding: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                                    <h4 style={{ margin: 0, color: 'var(--primary)' }}>Gemini Summary</h4>
                                    {canRetrySummary ? (
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={handleGenerateSummary}
                                            disabled={summaryLoading}
                                        >
                                            {summaryLoading ? "Generating..." : "Generate Summary"}
                                        </button>
                                    ) : null}
                                </div>
                                {geminiSummary ? (
                                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{geminiSummary}</div>
                                ) : geminiSummaryStatus === 'skipped' ? (
                                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                                        Summary generation is not enabled yet. Add `GEMINI_API_KEY` to the Appwrite function environment to generate summaries.
                                    </p>
                                ) : geminiSummaryStatus === 'failed' ? (
                                    <div>
                                        <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)' }}>
                                            Gemini could not generate a summary for this document.
                                        </p>
                                        {geminiError ? (
                                            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>{geminiError}</p>
                                        ) : null}
                                    </div>
                                ) : (
                                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                                        Summary is not available for this document yet.
                                    </p>
                                )}
                                {summaryMessage ? (
                                    <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                        {summaryMessage}
                                    </p>
                                ) : null}
                            </div>

                            {data.keyValues && data.keyValues.length > 0 && (
                                <div style={{ marginBottom: '2rem' }}>
                                    <h4 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Key Value Pairs</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        {data.keyValues.map((kv, i) => (
                                            <div key={i} style={{ background: 'rgba(255,255,255,0.5)', padding: '0.75rem', borderRadius: '8px' }}>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{kv.key}</div>
                                                <div style={{ fontWeight: 500 }}>{kv.value || '-'}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {data.tables && data.tables.length > 0 && (
                                <div>
                                    <h4 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Extracted Tables</h4>
                                    {data.tables.map((table, i) => (
                                        <div key={i} style={{ overflowX: 'auto', marginBottom: '1.5rem', background: 'white', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                                <tbody>
                                                    {Array.from({ length: table.rowCount }).map((_, rowIdx) => (
                                                        <tr key={rowIdx} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                                            {Array.from({ length: table.columnCount }).map((_, colIdx) => {
                                                                const cell = table.cells.find(c => c.row === rowIdx && c.col === colIdx);
                                                                return (
                                                                    <td key={colIdx} style={{ padding: '0.75rem', borderRight: '1px solid rgba(0,0,0,0.05)' }}>
                                                                        {cell ? cell.text : ''}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!data.keyValues?.length && !data.tables?.length && (
                                <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.5)', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                                    {report.extractedText || "No complex structure detected. Only raw text was found."}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="empty-state">No Data Found</div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
