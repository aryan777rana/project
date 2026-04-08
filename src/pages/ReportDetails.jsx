import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { databases, storage } from "../lib/appwrite";
import { motion } from "framer-motion";

export default function ReportDetails() {
    const { id } = useParams();
    const [report, setReport] = useState(null);
    const [data, setData] = useState(null);
    const [imageUrl, setImageUrl] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        async function fetchDetails() {
            try {
                const doc = await databases.getDocument("medical_data", "reports", id);
                setReport(doc);
                
                // Fetch image preview URL from storage
                if (doc.fileId) {
                    const previewUrl = await storage.getFileView("reports_bucket", doc.fileId);
                    setImageUrl(previewUrl);

                }

                if (doc.structuredData) {
                    setData(JSON.parse(doc.structuredData));
                }
            } catch (err) {
                setError(err.message);
            }
        }
        fetchDetails();
    }, [id]);

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
