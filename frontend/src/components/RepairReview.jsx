import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import api from '../api/axios';

const RepairReview = ({ incidentId, onSuccess }) => {
    const sigCanvas = useRef({});
    const [repairData, setRepairData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statusMsg, setStatusMsg] = useState({ type: '', message: '' });

    useEffect(() => {
        const fetchRepair = async () => {
            try {
                // Fetch repairs and find the one linked to this incident.
                const res = await api.get('/api/repairs/');
                const repairsArray = res.data.results || res.data;
                const linkedRepair = repairsArray.find((r) => r.incident === incidentId);

                if (linkedRepair) {
                    setRepairData(linkedRepair);
                } else {
                    setStatusMsg({ type: 'error', message: 'No repair record found for this incident.' });
                }
            } catch (err) {
                setStatusMsg({ type: 'error', message: 'Failed to load repair details.' });
            } finally {
                setLoading(false);
            }
        };

        fetchRepair();
    }, [incidentId]);

    const handleCertify = async () => {
        if (sigCanvas.current.isEmpty()) {
            return setStatusMsg({ type: 'error', message: 'Please provide your signature to certify.' });
        }

        setStatusMsg({ type: 'info', message: 'Processing certification...' });

        try {
            const signatureBlob = await new Promise((resolve) =>
                sigCanvas.current.getTrimmedCanvas().toBlob(resolve, 'image/png')
            );

            const formData = new FormData();
            formData.append('supervisor_signature', signatureBlob, 'signature.png');

            await api.patch(`/api/repairs/${repairData.id}/certify/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setStatusMsg({ type: 'success', message: 'Certified! Incident is now officially RESOLVED.' });

            if (onSuccess) {
                setTimeout(onSuccess, 2000);
            }
        } catch (error) {
            setStatusMsg({ type: 'error', message: error.response?.data?.error || 'Certification failed.' });
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <i className="fas fa-spinner fa-spin"></i> Loading repair details...
            </div>
        );
    }

    if (!repairData) {
        return <div style={{ padding: '20px', color: '#e11d48' }}>{statusMsg.message}</div>;
    }

    return (
        <div style={{ padding: '10px' }}>
            <h3 style={{ color: '#1a6fb0', marginBottom: '20px', borderBottom: '2px solid #e0f0fa', paddingBottom: '10px' }}>
                <i className="fas fa-clipboard-check"></i> Review & Certify Work
            </h3>

            {statusMsg.message && (
                <div
                    style={{
                        padding: '12px',
                        marginBottom: '20px',
                        borderRadius: '6px',
                        backgroundColor: statusMsg.type === 'success' ? '#d1fae5' : statusMsg.type === 'error' ? '#fee2e2' : '#e0f2fe',
                        color: statusMsg.type === 'success' ? '#065f46' : statusMsg.type === 'error' ? '#991b1b' : '#0369a1',
                    }}
                >
                    {statusMsg.message}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Repair Type</p>
                    <p style={{ margin: '5px 0 0 0', color: '#0f172a', fontWeight: '500' }}>{repairData.repair_type.replace('_', ' ')}</p>
                </div>
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Completion Date</p>
                    <p style={{ margin: '5px 0 0 0', color: '#0f172a', fontWeight: '500' }}>{new Date(repairData.completion_date).toLocaleDateString()}</p>
                </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Scope of Work Executed</p>
                <p style={{ margin: '8px 0 0 0', color: '#0f172a', whiteSpace: 'pre-wrap' }}>{repairData.scope_of_work}</p>
            </div>

            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '25px' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Materials Used</p>
                <p style={{ margin: '8px 0 0 0', color: '#0f172a', whiteSpace: 'pre-wrap' }}>{repairData.materials_used || 'None recorded.'}</p>
            </div>

            <div style={{ border: '2px dashed #cbd5e1', padding: '20px', borderRadius: '8px', background: 'white' }}>
                <p style={{ margin: '0 0 15px 0', fontWeight: 'bold', color: '#334155' }}>
                    <i className="fas fa-pen-nib"></i> Supervisor Digital Signature
                </p>
                <div style={{ border: '1px solid #94a3b8', borderRadius: '6px', background: '#f8fafc', marginBottom: '15px' }}>
                    <SignatureCanvas
                        ref={sigCanvas}
                        penColor="darkblue"
                        canvasProps={{ style: { width: '100%', height: '150px' }, className: 'sigCanvas' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => sigCanvas.current.clear()} style={{ background: '#e2e8f0', color: '#475569', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                        Clear
                    </button>
                    <button onClick={handleCertify} style={{ background: '#16a34a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', flex: 1 }}>
                        <i className="fas fa-check-double"></i> Certify & Close Task
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RepairReview;
